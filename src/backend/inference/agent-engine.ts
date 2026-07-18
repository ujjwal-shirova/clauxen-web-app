/**
 * Autonomous Agent Orchestration Engine.
 *
 * Cognitive architecture ported from Clauxen Code CLI
 * (`vendor/clauxen-code-agent` — query loop + StreamingToolExecutor patterns).
 *
 * Uses Anthropic Messages API ONLY (@anthropic-ai/sdk) — no OpenAI Chat
 * Completions translation. Streams into ClauxenSseStream for the Worked-for
 * timeline UI.
 *
 * Architecture:
 *  1. Agentic Loop — multi-step tool-call cycles (Clauxen Code query.ts).
 *  2. Frame Events — ONE activity frame for the whole assistant turn
 *     (not one Brewed/Churned chip per tool round).
 *  3. Interim Narrative — text between tools as progress notes.
 *  4. Self-Healing — malformed tool args healed without an LLM round-trip.
 *  5. Parallel Tool Calls — independent tools execute concurrently.
 */

import {
  streamAnthropicMessages,
  toAnthropicTools,
  type AnthropicChatMessage,
} from "@/backend/inference/anthropic-messages-client";
import type { ClauxenSseStream } from "@/backend/inference/clauxen-sse-stream";
import {
  healToolArgs,
  executeToolSafely,
  type ToolDefinition,
  type ToolExecutionContext,
} from "@/backend/inference/tool-healer";
import { executeAutonomousTool } from "@/backend/inference/autonomous-tools/executor";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import { autonomousAgentTools } from "@/backend/inference/autonomous-tools/definitions";
import { parse as parsePartialJson, Allow } from "partial-json";
import { z } from "zod";
import type { ConfiguredModelId } from "@/lib/model-config";
import {
  resolveAutonomousThinkingParams,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/model-catalog";
import Anthropic from "@anthropic-ai/sdk";
import {
  requireProviderApiKey,
  requireAnthropicBaseUrl,
  env,
} from "@/backend/config/env";

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
};

/** Build Anthropic tool definitions from our autonomous tool catalog. */
function buildAnthropicTools() {
  return toAnthropicTools(
    autonomousAgentTools.map((tool) => ({
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
  messages: Array<{ role: string; content: string }>;
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
  let textSegmentCounter = 0;
  let activeTextSegmentId: string | null = null;

  const openFrame = () => {
    if (frameOpen) return;
    sse.writeFrameStart(frameId);
    frameOpen = true;
  };

  const closeActiveTextSegment = () => {
    if (!activeTextSegmentId) return;
    sse.writeSegmentEnd(activeTextSegmentId, "text");
    activeTextSegmentId = null;
  };

  const closeFrame = () => {
    closeActiveTextSegment();
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

      let sawToolCall = false;
      let thinkingOpen = false;
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      const toolCallBuffers = new Map<
        string,
        { name: string; argsBuffer: string }
      >();
      let fullText = "";
      let fullReasoning = "";

      const stream = streamAnthropicMessages({
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
        sse.writeThinkingStart();
        thinkingOpen = true;
      };

      const closeThinking = () => {
        if (!thinkingOpen) return;
        sse.writeThinkingEnd();
        thinkingOpen = false;
      };

      for await (const part of stream) {
        switch (part.type) {
          case "reasoning-delta":
            openFrame();
            ensureThinkingOpen();
            sse.writeThinkingDelta(part.delta);
            fullReasoning += part.delta;
            break;

          case "text-delta": {
            const visible = sanitizeAssistantStreamDelta(part.delta);
            if (!visible) break;
            closeThinking();
            if (!sawToolCall) {
              sse.writeAnswerDelta(visible);
            } else {
              if (!activeTextSegmentId) {
                textSegmentCounter += 1;
                activeTextSegmentId = `${frameId}-text-${textSegmentCounter}`;
                sse.writeSegmentStart(activeTextSegmentId, "text");
              }
              sse.writeTextDelta(activeTextSegmentId, visible);
            }
            fullText += visible;
            break;
          }

          case "tool-call-start":
            openFrame();
            closeThinking();
            if (!sawToolCall) {
              sawToolCall = true;
              if (fullText.trim()) {
                sse.writeAnswerClear();
                sse.writeIntroNarrative(fullText.trim());
              }
            } else {
              closeActiveTextSegment();
            }
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
              sse.writeToolStart(
                part.toolCallId,
                entry.name,
                preview,
                undefined,
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

      closeActiveTextSegment();
      closeThinking();

      if (pendingToolCalls.length === 0) {
        closeFrame();
        break;
      }

      // Anthropic assistant turn: text + tool_use (thinking stays UI-only —
      // replaying thinking blocks needs a valid signature from the API).
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (fullText.trim()) {
        assistantContent.push({ type: "text", text: fullText });
      }
      for (const tc of pendingToolCalls) {
        assistantContent.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: safeParseJson(tc.arguments),
        });
      }
      conversation.push({
        role: "assistant",
        content: assistantContent.length
          ? assistantContent
          : [{ type: "text", text: fullText || "" }],
      });

      for (const tc of pendingToolCalls) {
        sse.writeToolStart(
          tc.id,
          tc.name,
          safeParseJson(tc.arguments),
          undefined,
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
              const output = result.output as {
                path?: string;
                content?: string;
              };
              if (output.path && typeof output.content === "string") {
                sse.writeArtifact(
                  output.path,
                  output.path,
                  output.content,
                  undefined,
                );
              }
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
                  undefined,
                );
              }
            }

            const resultStr =
              typeof result.output === "string"
                ? result.output
                : JSON.stringify(result.output ?? {});

            if (result.pauseForUser || tc.name === "ask_user_input_v0") {
              pauseForUser = true;
            }

            sse.writeToolEnd(tc.id, tc.name, resultStr);

            return {
              toolCallId: tc.id,
              name: tc.name,
              result: resultStr,
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

            if (
              (tc.name === "create_file" || tc.name === "file_write") &&
              outcome.output &&
              typeof outcome.output === "object"
            ) {
              const output = outcome.output as {
                path?: string;
                content?: string;
              };
              if (output.path && typeof output.content === "string") {
                sse.writeArtifact(
                  output.path,
                  output.path,
                  output.content,
                  undefined,
                );
              }
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
                  undefined,
                );
              }
            }

            if (outcome.pauseForUser || tc.name === "ask_user_input_v0") {
              pauseForUser = true;
            }

            sse.writeToolEnd(tc.id, tc.name, resultStr);
            return { toolCallId: tc.id, name: tc.name, result: resultStr };
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : String(error);
            sse.writeToolEnd(
              tc.id,
              tc.name,
              JSON.stringify({ error: errMsg }),
            );
            return {
              toolCallId: tc.id,
              name: tc.name,
              result: JSON.stringify({ error: errMsg }),
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
        })),
      });

      sse.writeStepDone(`Step ${step + 1} complete`);

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
