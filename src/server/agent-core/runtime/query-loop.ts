/**
 * Claude Code–style query loop for Clauxen Web (Provider / Novita only).
 *
 * Stream → tools → tool_result → repeat. Wired through @/server/agent-core.
 * DOM transcript: ClauxenSseStream → src/components/agent/*.
 */

import {
  toAnthropicTools,
  requireProviderApiKey,
  requireAnthropicBaseUrl,
  env,
  type AnthropicChatMessage,
} from "@/server/agent-core/provider/messages-client";
import type { ClauxenSseStream } from "@/server/inference/clauxen-sse-stream";
import {
  healToolArgs,
  executeToolSafely,
  type ToolDefinition,
  type ToolExecutionContext,
} from "@/server/inference/tool-healer";
import {
  executeAutonomousTool,
  autonomousAgentTools,
} from "@/server/agent-core/tools";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import { inferLanguage } from "@/server/inference/platform-tools";
import { parse as parsePartialJson, Allow } from "partial-json";
import { z } from "zod";
import type { ConfiguredModelId } from "@/lib/model-config";
import {
  resolveAutonomousThinkingParams,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/model-catalog";
import Anthropic from "@anthropic-ai/sdk";
import { productionDeps, type QueryDeps } from "@/server/agent-core/query/deps";
import {
  captureAnthropicContentBlocks,
  toolResultPart,
  type TranscriptAgentModelTurn,
} from "@/server/training/transcript-format";
import {
  parseAgentTextMarkup,
  parseThinkingMarkup,
} from "@/lib/agent-transcript-markup";

/** Single autonomous step budget. The model decides how many steps it needs. */
const MAX_STEPS = 24;

// ── Zod schemas for autonomous tools (for self-healing validation) ─────────

const autonomousZodByName: Record<string, z.ZodTypeAny> = {
  read_skill: z.object({
    skill_id: z.string(),
  }),
  web_search: z.object({
    query: z.string(),
  }),
  web_fetch: z.object({
    url: z.string(),
  }),
  execute_code: z.object({
    code: z.string(),
  }),
  bash_tool: z.object({
    command: z.string(),
    description: z.string(),
  }),
  weather_fetch: z.object({
    location_name: z.string(),
    units: z.enum(["metric", "imperial"]).optional(),
  }),
  places_search: z.object({
    query: z.string(),
    max_results: z.number().optional(),
  }),
  image_search: z.object({
    query: z.string(),
    max_results: z.number().optional(),
  }),
  present_files: z.object({
    paths: z.array(z.string()).min(1),
  }),
  file_read: z.object({
    path: z.string(),
  }),
  create_file: z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional(),
  }),
  file_write: z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional(),
  }),
  ask_user_input_v0: z.object({
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(4),
        type: z
          .enum(["single_select", "multi_select", "rank_priorities"])
          .optional(),
      }),
    ).min(1).max(3),
  }),
  create_scheduled_task: z.object({
    name: z.string(),
    requirement: z.string(),
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    time_local: z.string(),
    timezone: z.string(),
    run_date: z.union([z.string(), z.null()]).optional(),
    day_of_week: z.union([z.number(), z.null()]).optional(),
    day_of_month: z.union([z.number(), z.null()]).optional(),
    expires_at: z.union([z.string(), z.null()]).optional(),
  }),
  list_scheduled_tasks: z.object({
    include_completed: z.boolean().optional(),
  }),
  cancel_scheduled_task: z.object({
    task_id: z.string(),
  }),
};

/** create_file auto-presents — emit downloadable artifact immediately. */
function emitCreatedFileArtifact(
  sse: ClauxenSseStream,
  output: unknown,
  fallbackPath?: string,
  fallbackContent?: string,
  description?: string,
) {
  const record =
    output && typeof output === "object"
      ? (output as Record<string, unknown>)
      : null;
  const path =
    (typeof record?.path === "string" && record.path) || fallbackPath || "";
  const content =
    (typeof record?.content === "string" && record.content) ||
    fallbackContent ||
    "";
  if (!path || !content) return;
  sse.writeArtifact(
    path,
    path,
    content,
    inferLanguage(path),
    typeof description === "string"
      ? description
      : typeof record?.description === "string"
        ? record.description
        : undefined,
  );
}

/** Build Anthropic tool definitions from our autonomous tool catalog. */
function buildAnthropicTools() {
  return toAnthropicTools(
    autonomousAgentTools
      // present_files removed — create_file auto-presents to the user.
      .filter((tool) => tool.name !== "present_files")
      .map((tool) => ({
        name: tool.name,
        description: tool.description ?? tool.name,
        parameters: (tool.parameters ?? {
          type: "object",
          properties: {},
        }) as Record<string, unknown>,
      })),
  );
}

/** Build self-healing tool definitions with Zod schemas. */
function buildHealingTools(): Map<string, ToolDefinition> {
  const map = new Map<string, ToolDefinition>();
  for (const def of autonomousAgentTools) {
    const schema = autonomousZodByName[def.name];
    if (!schema) continue;
    map.set(def.name, {
      name: def.name,
      description: def.description ?? def.name,
      inputSchema: schema,
      execute: async (input, ctx) => {
        return executeAutonomousTool(def.name, input, {
          conversationId: ctx.conversationId ?? "chat",
          userId: ctx.userId,
          userCountryCode: ctx.userCountryCode,
          toolCallId: ctx.toolCallId,
          onToolProgress: ctx.onProgress,
        });
      },
    });
  }
  return map;
}

export type AgentStreamOptions = {
  messages: Array<{
    role: string;
    content: string | Anthropic.ContentBlockParam[];
  }>;
  model: string;
  chatModelId?: ConfiguredModelId;
  homerReasoningEffort?: HomerReasoningEffort;
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  signal?: AbortSignal;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Fired when ask_user_input pauses the loop — release generation lease early. */
  onPauseForUser?: () => void | Promise<void>;
  /** Captures exact signed Messages API rounds for durable replay/training. */
  onModelTurn?: (turn: TranscriptAgentModelTurn) => void;
  /** Claude Code–style injectable deps (defaults to Provider production wiring). */
  deps?: QueryDeps;
};

function resolveThinkingBudget(
  options: AgentStreamOptions,
): number {
  const thinking = resolveAutonomousThinkingParams({
    chatModel: options.chatModelId ?? DEFAULT_CHAT_MODEL_ID,
    homerReasoningEffort: options.homerReasoningEffort,
  });
  if (!thinking.enable_thinking) return 0;
  // Map effort → Anthropic thinking budget (Clauxen Code style).
  const effort = String(thinking.reasoning_effort ?? "high");
  switch (effort) {
    case "low":
      return 2_048;
    case "medium":
      return 5_120;
    case "max":
      return 10_240;
    case "high":
    default:
      return 10_240;
  }
}

/**
 * Run the autonomous agent loop (Anthropic Messages), streaming to the UI.
 *
 * Loop (from Clauxen Code query.ts):
 *  1. Stream model response (thinking + text + tool_use).
 *  2. Execute tools (parallel when safe).
 *  3. Append tool_result blocks; call model again.
 *  4. Repeat until no more tool_use.
 */
export async function runAutonomousAgent(
  sse: ClauxenSseStream,
  options: AgentStreamOptions,
): Promise<void> {
  const {
    messages: rawMessages,
    userId,
    conversationId,
    userCountryCode,
    signal,
    systemPrompt,
    temperature,
    maxTokens,
    onPauseForUser,
  } = options;

  const deps = options.deps ?? productionDeps();
  const healingTools = buildHealingTools();
  const anthropicTools = buildAnthropicTools();
  const thinkingBudget = resolveThinkingBudget(options);

  // Anthropic: system is separate; history is user/assistant only.
  let conversation: AnthropicChatMessage[] = rawMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  sse.writeStart(true);

  // One activity frame for the entire assistant turn (Clauxen Code–style).
  const frameId = "agent-frame-1";
  let frameOpen = false;
  let narrationSegmentCounter = 0;
  let thinkingSegmentCounter = 0;
  let activeNarrationSegmentId: string | null = null;
  let activeThinkingSegmentId: string | null = null;

  const openFrame = () => {
    if (frameOpen) return;
    sse.writeFrameStart(frameId);
    frameOpen = true;
  };

  const closeActiveNarrationSegment = () => {
    if (!activeNarrationSegmentId) return;
    sse.writeSegmentEnd(activeNarrationSegmentId, "narration");
    activeNarrationSegmentId = null;
  };

  const closeFrame = () => {
    closeActiveNarrationSegment();
    if (!frameOpen) return;
    sse.writeFrameComplete(frameId);
    frameOpen = false;
  };

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal?.aborted) {
        closeFrame();
        sse.writeError("Generation aborted.");
        return;
      }

      const modelTurnStartedAtMs = Date.now();
      let sawToolCall = false;
      let thinkingOpen = false;
      let thinkingSegmentId: string | null = null;
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      const toolCallBuffers = new Map<
        string,
        { name: string; argsBuffer: string }
      >();
      let rawText = "";
      let rawReasoning = "";
      let emittedAnswerText = "";
      let emittedNarration = "";
      let visibleTextAtFirstTool = "";
      let emittedPostToolNarration = "";
      let emittedThinking = "";
      let parsedText = parseAgentTextMarkup("");
      let finished:
        | { reason: string; content: Anthropic.ContentBlock[] }
        | undefined;
      const turnNarrationSegmentIds: string[] = [];

      const stream = deps.callModel({
        model: options.model,
        system: systemPrompt,
        messages: conversation,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        temperature: temperature ?? 0.6,
        max_tokens: maxTokens ?? 8192,
        thinkingBudgetTokens: thinkingBudget,
        signal,
      });

      const ensureThinkingOpen = () => {
        if (thinkingOpen) return;
        thinkingSegmentCounter += 1;
        activeThinkingSegmentId = `${frameId}-thinking-${thinkingSegmentCounter}`;
        thinkingSegmentId = activeThinkingSegmentId;
        openFrame();
        sse.writeSegmentStart(activeThinkingSegmentId, "thinking");
        sse.writeThinkingStart();
        thinkingOpen = true;
      };

      const closeThinking = () => {
        if (!thinkingOpen) return;
        const segmentId = activeThinkingSegmentId ?? undefined;
        sse.writeThinkingEnd(segmentId);
        if (segmentId) {
          sse.writeSegmentEnd(segmentId, "thinking");
        }
        thinkingOpen = false;
        activeThinkingSegmentId = null;
      };

      const ensureNarrationOpen = () => {
        if (activeNarrationSegmentId) return activeNarrationSegmentId;
        narrationSegmentCounter += 1;
        activeNarrationSegmentId = `${frameId}-narration-${narrationSegmentCounter}`;
        turnNarrationSegmentIds.push(activeNarrationSegmentId);
        openFrame();
        sse.writeSegmentStart(activeNarrationSegmentId, "narration");
        return activeNarrationSegmentId;
      };

      for await (const part of stream) {
        switch (part.type) {
          case "reasoning-delta": {
            openFrame();
            ensureThinkingOpen();
            rawReasoning += part.delta;
            const parsed = parseThinkingMarkup(rawReasoning);
            if (parsed.heading && thinkingSegmentId) {
              sse.writeThinkingHeading(thinkingSegmentId, parsed.heading);
            }
            if (parsed.body.startsWith(emittedThinking)) {
              const delta = parsed.body.slice(emittedThinking.length);
              if (delta) {
                sse.writeThinkingDelta(
                  delta,
                  activeThinkingSegmentId ?? undefined,
                );
                emittedThinking = parsed.body;
              }
            }
            break;
          }

          case "text-delta": {
            const visible = sanitizeAssistantStreamDelta(part.delta);
            if (!visible) break;
            closeThinking();
            rawText += visible;
            parsedText = parseAgentTextMarkup(rawText);

            if (parsedText.heading && thinkingSegmentId) {
              sse.writeThinkingHeading(thinkingSegmentId, parsedText.heading);
            }

            if (parsedText.narration.startsWith(emittedNarration)) {
              const narrationDelta = parsedText.narration.slice(
                emittedNarration.length,
              );
              if (narrationDelta) {
                const segmentId = ensureNarrationOpen();
                sse.writeNarrationDelta(segmentId, narrationDelta);
                emittedNarration = parsedText.narration;
              }
            }

            if (
              !sawToolCall &&
              parsedText.visibleText.startsWith(emittedAnswerText)
            ) {
              const answerDelta = parsedText.visibleText.slice(
                emittedAnswerText.length,
              );
              if (answerDelta) {
                sse.writeAnswerDelta(answerDelta);
                emittedAnswerText = parsedText.visibleText;
              }
            } else if (
              sawToolCall &&
              parsedText.visibleText.startsWith(visibleTextAtFirstTool)
            ) {
              const postToolNarration = parsedText.visibleText.slice(
                visibleTextAtFirstTool.length,
              );
              if (postToolNarration.startsWith(emittedPostToolNarration)) {
                const narrationDelta = postToolNarration.slice(
                  emittedPostToolNarration.length,
                );
                if (narrationDelta) {
                  const segmentId = ensureNarrationOpen();
                  sse.writeNarrationDelta(segmentId, narrationDelta);
                  emittedPostToolNarration = postToolNarration;
                }
              }
            }
            break;
          }

          case "tool-call-start":
            openFrame();
            closeThinking();
            if (!sawToolCall) {
              sawToolCall = true;
              visibleTextAtFirstTool = emittedAnswerText;
              if (emittedAnswerText.trim()) {
                sse.writeAnswerClear();
                closeActiveNarrationSegment();
                const segmentId = ensureNarrationOpen();
                sse.writeNarrationDelta(segmentId, emittedAnswerText.trim());
                // Pre-tool prose is progress, not the durable final answer.
                emittedAnswerText = "";
              }
            }
            closeActiveNarrationSegment();
            sse.writeToolStart(
              part.toolCallId,
              part.toolName,
              undefined,
              undefined,
              false,
            );
            toolCallBuffers.set(part.toolCallId, {
              name: part.toolName,
              argsBuffer: "",
            });
            break;

          case "tool-call-delta": {
            const entry = toolCallBuffers.get(part.toolCallId) ?? {
              name: "",
              argsBuffer: "",
            };
            entry.argsBuffer += part.argumentsDelta;
            toolCallBuffers.set(part.toolCallId, entry);
            const preview = previewToolArgs(entry.argsBuffer);
            if (entry.name && Object.keys(preview).length > 0) {
              const dynamicDescription =
                typeof preview.description === "string"
                  ? preview.description
                  : undefined;
              sse.writeToolStart(
                part.toolCallId,
                entry.name,
                preview,
                dynamicDescription,
                false,
              );
            }
            break;
          }

          case "tool-call-end":
            pendingToolCalls.push({
              id: part.toolCallId,
              name: part.toolName,
              arguments: part.arguments,
            });
            break;

          case "finish":
            finished = {
              reason: part.reason,
              content: part.content,
            };
            break;

          case "error":
            closeFrame();
            sse.writeError(part.error);
            return;

          case "abort":
            closeFrame();
            sse.writeError("Generation aborted.");
            return;
        }
      }

      closeActiveNarrationSegment();
      closeThinking();
      const assistantCompletedAtMs = Date.now();

      if (pendingToolCalls.length === 0) {
        // Flush final prose into the durable answer channel when nothing was
        // emitted as answer yet (e.g. only narration, or post-tool text held
        // as narration). Follow-up turns replay this persisted answer.
        if (!emittedAnswerText.trim()) {
          const finalAnswer =
            parsedText.visibleText.trim() || parsedText.narration.trim();
          if (finalAnswer) {
            for (const segmentId of turnNarrationSegmentIds) {
              sse.writeSegmentRemove(segmentId);
            }
            sse.writeAnswerDelta(finalAnswer);
            emittedAnswerText = finalAnswer;
          }
        }
        if (finished) {
          try {
            options.onModelTurn?.({
              stopReason: finished.reason,
              startedAtMs: modelTurnStartedAtMs,
              assistantCompletedAtMs,
              completedAtMs: assistantCompletedAtMs,
              assistant: captureAnthropicContentBlocks(finished.content),
            });
          } catch {
            // Transcript capture must never break the visible response.
          }
        }
        closeFrame();
        break;
      }

      if (!finished || finished.content.length === 0) {
        throw new Error(
          "The model requested a tool without a replayable assistant message.",
        );
      }

      // Replay the exact API response, including signed/redacted thinking.
      // Rebuilding or filtering these blocks breaks Anthropic reasoning
      // continuity and can produce a 400 on the next tool-result request.
      conversation.push({
        role: "assistant",
        content: finished.content as unknown as Anthropic.ContentBlockParam[],
      });

      for (const tc of pendingToolCalls) {
        const args = safeParseJson(tc.arguments);
        sse.writeToolStart(
          tc.id,
          tc.name,
          args,
          typeof args.description === "string" ? args.description : undefined,
          true,
        );
      }

      let pauseForUser = false;
      const toolResults = await Promise.all(
        pendingToolCalls.map(async (tc) => {
          const healingTool = healingTools.get(tc.name);
          const rawArgs = safeParseJson(tc.arguments);

          if (healingTool) {
            const ctx: ToolExecutionContext = {
              userId,
              conversationId: conversationId ?? "chat",
              userCountryCode,
              toolCallId: tc.id,
              onProgress: (data) => {
                if (tc.name === "web_search") {
                  sse.writeToolData(tc.id, {
                    ...data,
                    tool_call_id: tc.id,
                  });
                } else if (
                  tc.name === "bash_tool" &&
                  (data.kind === "stdout" || data.kind === "stderr") &&
                  typeof data.delta === "string"
                ) {
                  sse.writeToolOutputDelta(tc.id, data.kind, data.delta);
                }
              },
            };

            const healed = healToolArgs(rawArgs, healingTool.inputSchema);
            const result = await executeToolSafely(
              healingTool,
              healed ?? rawArgs,
              ctx,
            );

            if (
              tc.name === "web_search" &&
              result.output &&
              typeof result.output === "object"
            ) {
              const output = result.output as Record<string, unknown>;
              if (Array.isArray(output.results)) {
                sse.writeToolData(tc.id, {
                  tool_call_id: tc.id,
                  query: output.query,
                  results: output.results,
                });
              }
            }

            if (
              (tc.name === "create_file" || tc.name === "file_write") &&
              result.output &&
              typeof result.output === "object"
            ) {
              emitCreatedFileArtifact(
                sse,
                result.output,
                typeof rawArgs.path === "string" ? rawArgs.path : undefined,
                typeof rawArgs.content === "string" ? rawArgs.content : undefined,
                typeof rawArgs.description === "string"
                  ? rawArgs.description
                  : undefined,
              );
            }

            if (
              tc.name === "present_files" &&
              result.output &&
              typeof result.output === "object"
            ) {
              const output = result.output as {
                files?: Array<{ path: string; content: string }>;
              };
              for (const file of output.files ?? []) {
                sse.writeArtifact(
                  file.path,
                  file.path,
                  file.content,
                  inferLanguage(file.path),
                );
              }
            }

            const resultStr =
              typeof result.output === "string"
                ? result.output
                : JSON.stringify(result.output ?? {});
            const isError = isToolErrorOutput(result.output);

            if (result.pauseForUser || tc.name === "ask_user_input_v0") {
              pauseForUser = true;
            }

            sse.writeToolEnd(tc.id, tc.name, resultStr, isError);

            return {
              toolCallId: tc.id,
              name: tc.name,
              result: resultStr,
              isError,
            };
          }

          try {
            const outcome = await executeAutonomousTool(tc.name, rawArgs, {
              conversationId: conversationId ?? "chat",
              userId,
              userCountryCode,
              toolCallId: tc.id,
              onToolProgress: (data) => {
                if (tc.name === "web_search") {
                  sse.writeToolData(tc.id, {
                    ...data,
                    tool_call_id: tc.id,
                  });
                }
              },
            });
            const resultStr =
              typeof outcome.output === "string"
                ? outcome.output
                : JSON.stringify(outcome.output ?? {});
            const isError = isToolErrorOutput(outcome.output);

            if (
              (tc.name === "create_file" || tc.name === "file_write") &&
              outcome.output &&
              typeof outcome.output === "object"
            ) {
              emitCreatedFileArtifact(
                sse,
                outcome.output,
                typeof rawArgs.path === "string" ? rawArgs.path : undefined,
                typeof rawArgs.content === "string" ? rawArgs.content : undefined,
                typeof rawArgs.description === "string"
                  ? rawArgs.description
                  : undefined,
              );
            }

            if (
              tc.name === "present_files" &&
              outcome.output &&
              typeof outcome.output === "object"
            ) {
              const output = outcome.output as {
                files?: Array<{ path: string; content: string }>;
              };
              for (const file of output.files ?? []) {
                sse.writeArtifact(
                  file.path,
                  file.path,
                  file.content,
                  inferLanguage(file.path),
                );
              }
            }

            if (outcome.pauseForUser || tc.name === "ask_user_input_v0") {
              pauseForUser = true;
            }

            sse.writeToolEnd(tc.id, tc.name, resultStr, isError);
            return {
              toolCallId: tc.id,
              name: tc.name,
              result: resultStr,
              isError,
            };
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : String(error);
            sse.writeToolEnd(
              tc.id,
              tc.name,
              JSON.stringify({ error: errMsg }),
              true,
            );
            return {
              toolCallId: tc.id,
              name: tc.name,
              result: JSON.stringify({ error: errMsg }),
              isError: true,
            };
          }
        }),
      );

      // Anthropic: tool results are a user message with tool_result blocks.
      conversation.push({
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.toolCallId,
          content: tr.result,
          ...(tr.isError ? { is_error: true } : {}),
        })),
      });

      try {
        options.onModelTurn?.({
          stopReason: finished.reason,
          startedAtMs: modelTurnStartedAtMs,
          assistantCompletedAtMs,
          completedAtMs: Date.now(),
          assistant: captureAnthropicContentBlocks(finished.content),
          toolResults: toolResults.map((result) =>
            toolResultPart(
              result.toolCallId,
              result.result,
              result.isError,
            ),
          ),
        });
      } catch {
        // Transcript capture must never break the visible response.
      }

      // Keep a single activity frame across tool rounds — closing here used
      // to spawn stacked "Brewed for 3s / Churned for 21s" chips.
      if (pauseForUser) {
        closeFrame();
        try {
          await onPauseForUser?.();
        } catch {
          // Lease release is best-effort; stream still completes.
        }
        break;
      }
    }
  } catch (error) {
    const aborted =
      signal?.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.name === "ResponseAborted" ||
          /aborted/i.test(error.message)));

    closeFrame();
    if (aborted) {
      sse.writeError("Generation aborted.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sse.writeError(message);
    return;
  } finally {
    closeFrame();
    sse.writeDone();
    sse.finalize();
  }
}

/** Generate a chat title using a non-streaming Anthropic completion. */
export async function generateChatTitle(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<string> {
  const userContent =
    messages.find((m) => m.role === "user")?.content?.trim() ?? "";
  const assistantContent =
    messages.find((m) => m.role === "assistant")?.content?.trim() ?? "";

  if (!userContent) return "New Chat";

  try {
    const client = new Anthropic({
      apiKey: requireProviderApiKey(),
      baseURL: requireAnthropicBaseUrl(),
    });
    const response = await client.messages.create(
      {
        model: optionsModelForTitle(),
        max_tokens: 48,
        temperature: 0.3,
        system:
          "You write short conversation titles for a chat sidebar. Output ONLY the title (3-6 words). No quotes or labels.",
        messages: [
          {
            role: "user",
            content: [
              userContent ? `User: ${userContent.slice(0, 500)}` : "",
              assistantContent
                ? `Assistant: ${assistantContent.slice(0, 500)}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
      { signal },
    );
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return text.slice(0, 80) || userContent.slice(0, 50).trim();
  } catch {
    return userContent.slice(0, 50).trim();
  }
}

function optionsModelForTitle(): string {
  return env.heliosModel || env.defaultModel || "claude-sonnet-4-20250514";
}

function safeParseJson(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isToolErrorOutput(output: unknown): boolean {
  return Boolean(
    output &&
      typeof output === "object" &&
      !Array.isArray(output) &&
      typeof (output as { error?: unknown }).error === "string",
  );
}

/** Best-effort parse of a still-streaming tool-call arguments buffer (may be invalid/incomplete JSON). */
function previewToolArgs(buffer: string): Record<string, unknown> {
  if (!buffer.trim()) return {};
  try {
    return JSON.parse(buffer) as Record<string, unknown>;
  } catch {
    try {
      return parsePartialJson(buffer, Allow.ALL) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
