/**
 * Autonomous Agent Orchestration Engine.
 *
 * This is the cognitive architecture that wraps the static Novita OpenAI API
 * and turns it into a fully autonomous, self-healing agent loop — without
 * Vercel AI SDK, without @ai-sdk/openai.
 *
 * Architecture:
 *  1. Agentic Loop — runs multi-step tool-call cycles autonomously.
 *  2. Frame Events — each tool cycle opens/closes an agent frame for the UI.
 *  3. Interim Narrative — text between tool calls is captured as progress notes.
 *  4. Self-Healing — malformed tool args are deterministically healed (no LLM round-trip).
 *  5. Parallel Tool Calls — independent tools execute concurrently.
 *
 * The engine emits events via a ClauxenSseStream, which the frontend's
 * existing StreamEvent reducer consumes unchanged.
 */

import {
  streamChatCompletion,
  completeChat,
  type ChatMessage,
  type ToolDefinition as NovitaToolDefinition,
  type StreamPart,
} from "@/backend/inference/novita-client";
import type { ClauxenSseStream } from "@/backend/inference/clauxen-sse-stream";
import {
  healToolArgs,
  executeToolSafely,
  type ToolDefinition,
  type ToolExecutionContext,
} from "@/backend/inference/tool-healer";
import { executeAutonomousTool } from "@/backend/inference/autonomous-tools/executor";
import { buildConversationPayload } from "@/backend/inference/hebbian-memory";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import { autonomousAgentTools } from "@/backend/inference/autonomous-tools/definitions";
import { parse as parsePartialJson, Allow } from "partial-json";
import { z } from "zod";
import type { ConfiguredModelId } from "@/lib/model-config";
import {
  resolveAutonomousThinkingParams,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { DEFAULT_CHAT_MODEL_ID, modelCatalogEnvFromProcess } from "@/lib/model-catalog";

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
  file_read: z.object({
    path: z.string(),
  }),
  file_write: z.object({
    path: z.string(),
    content: z.string(),
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

/** Build Novita-format tool definitions from our autonomous tool catalog. */
function buildNovitaTools(): NovitaToolDefinition[] {
  return autonomousAgentTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? tool.name,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
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
};

function buildNovitaRequestOptions(
  options: AgentStreamOptions,
  overrides?: { temperature?: number; max_tokens?: number; parallel_tool_calls?: boolean; tools?: NovitaToolDefinition[] },
) {
  const chatModelId = options.chatModelId ?? DEFAULT_CHAT_MODEL_ID;
  // Thinking is model-driven, not a user toggle. Capable models reason
  // automatically; the model decides how deeply to think per task.
  const thinking = resolveAutonomousThinkingParams({
    chatModel: chatModelId,
    homerReasoningEffort: options.homerReasoningEffort,
  });

  return {
    model: options.model,
    messages: [] as ChatMessage[],
    temperature: overrides?.temperature ?? options.temperature ?? 0.6,
    max_tokens: overrides?.max_tokens ?? options.maxTokens ?? 8192,
    parallel_tool_calls: overrides?.parallel_tool_calls,
    tools: overrides?.tools,
    enable_thinking: thinking.enable_thinking,
    reasoning_effort: thinking.reasoning_effort,
    signal: options.signal,
  };
}

/**
 * Run the autonomous agent loop, streaming events to the frontend.
 *
 * The loop:
 *  1. Send messages + tools to Novita.
 *  2. Stream text/reasoning/tool-call deltas to the frontend in real-time.
 *  3. When tool calls complete, execute them (in parallel if independent).
 *  4. Feed results back as tool messages.
 *  5. Repeat until the model produces a final answer with no tool calls.
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
  } = options;

  // Single autonomous mode. Tools are ALWAYS armed (tool_choice: "auto") and
  // the model decides on its own whether/when to call them, whether to think,
  // and how many steps it needs. A turn that needs no tools streams a plain
  // answer with zero frame overhead; a turn that needs tools opens frames,
  // runs them, and loops until the model produces a final answer.
  const healingTools = buildHealingTools();
  const novitaTools = buildNovitaTools();

  // Build conversation messages with Hebbian context forging
  const goalText = rawMessages[rawMessages.length - 1]?.content ?? "";
  const forgedMessages = buildConversationPayload(
    systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...rawMessages]
      : rawMessages,
    goalText,
    100_000,
  );

  let conversation: ChatMessage[] = forgedMessages.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));

  sse.writeStart(true);

  // Single frame spans the WHOLE autonomous turn — every step's thinking,
  // narrative notes, and tool calls render inside ONE continuous vertical
  // timeline (matching the reference agent UI), instead of a new timeline
  // block opening for every model round-trip.
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
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      // Accumulated raw JSON per tool call, for the live "typing" preview
      // (e.g. bash_tool's command growing character-by-character in the UI
      // before the sandbox ever starts) — separate from pendingToolCalls,
      // which only fills in once a call is fully finished streaming.
      const toolCallBuffers = new Map<string, { name: string; argsBuffer: string }>();
      let fullText = "";
      let fullReasoning = "";

      const novitaBase = buildNovitaRequestOptions(options, {
        temperature: temperature ?? 0.6,
        max_tokens: maxTokens ?? 8192,
        parallel_tool_calls: true,
        tools: novitaTools.length > 0 ? novitaTools : undefined,
      });

      const stream = streamChatCompletion({
        ...novitaBase,
        messages: conversation,
      });

      let finishReason: string | null = null;

      for await (const part of stream) {
        switch (part.type) {
          case "reasoning-delta":
            // The model decides whether to think. Stream reasoning whenever the
            // model emits it — no user toggle gates this.
            openFrame();
            sse.writeThinkingDelta(part.delta);
            fullReasoning += part.delta;
            break;

          case "text-delta": {
            const visible = sanitizeAssistantStreamDelta(part.delta);
            if (!visible) break;
            // Stream live as answer text until a tool call proves it was a
            // pre-tool whisper — then it moves to introNarrative above the
            // timeline. Post-tool notes stay as timeline text segments.
            if (!sawToolCall) {
              sse.writeAnswerDelta(visible);
            } else {
              // Text after a tool call in this step is a narrative note —
              // stream it into its own persistent timeline segment (stays
              // visible after the frame collapses, unlike the old ephemeral
              // interim preview).
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
            if (!sawToolCall) {
              sawToolCall = true;
              if (fullText.trim()) {
                sse.writeAnswerClear();
                sse.writeIntroNarrative(fullText.trim());
              }
            } else {
              // A new tool call starts — close out any narrative note that
              // was streaming since the previous tool result so it renders
              // as its own row above this tool, not merged with it.
              closeActiveTextSegment();
            }
            // argsComplete: false from the first moment — otherwise it stays
            // undefined (== "complete" for tools that never stream partial
            // args) and the UI would briefly treat an about-to-stream call
            // as already finalized.
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
            // Stream a live preview of the growing arguments (e.g. bash_tool's
            // command typing into the block) before the call is complete and
            // before anything actually executes.
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
            finishReason = part.reason;
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

      // Close out any narrative segment left open at the end of this step —
      // the next step (if any) starts its own fresh narrative/answer text.
      // The frame itself stays open across steps; it only closes once the
      // whole autonomous turn actually finishes (see below and `finally`).
      closeActiveTextSegment();

      // If thinking was streaming and we have text, end thinking
      if (fullReasoning && fullText) {
        sse.writeThinkingEnd();
      }

      // If no tool calls, we're done — the text is the final answer.
      if (pendingToolCalls.length === 0) {
        closeFrame();
        break;
      }

      // Add assistant message with tool calls to conversation
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: fullText || null,
        tool_calls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      if (fullReasoning) {
        assistantMessage.reasoning_content = fullReasoning;
      }
      conversation.push(assistantMessage);

      // Emit full tool args before execution so interactive UIs can render,
      // and flag argsComplete so the UI can switch from "typing" to
      // "executing" (e.g. bash_tool showing its Output panel).
      for (const tc of pendingToolCalls) {
        sse.writeToolStart(
          tc.id,
          tc.name,
          safeParseJson(tc.arguments),
          undefined,
          true,
        );
      }

      // Execute tool calls in parallel (independent calls run concurrently)
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

            // Self-healing: heal args deterministically, then execute
            const healed = healToolArgs(rawArgs, healingTool.inputSchema);
            const result = await executeToolSafely(healingTool, healed ?? rawArgs, ctx);

            // Emit tool data for web search results etc.
            if (tc.name === "web_search" && result.output && typeof result.output === "object") {
              const output = result.output as Record<string, unknown>;
              if (Array.isArray(output.results)) {
                sse.writeToolData(tc.id, {
                  tool_call_id: tc.id,
                  query: output.query,
                  results: output.results,
                });
              }
            }

            if (tc.name === "file_write" && result.output && typeof result.output === "object") {
              const output = result.output as Record<string, unknown>;
              if (typeof output.path === "string") {
                sse.writeArtifact(
                  output.path,
                  output.path,
                  String(output.content ?? ""),
                  undefined,
                );
              }
            }

            const resultStr = typeof result.output === "string"
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

          // Fallback: execute via legacy executor
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
            const resultStr = typeof outcome.output === "string"
              ? outcome.output
              : JSON.stringify(outcome.output ?? {});

            if (outcome.pauseForUser || tc.name === "ask_user_input_v0") {
              pauseForUser = true;
            }

            sse.writeToolEnd(tc.id, tc.name, resultStr);
            return { toolCallId: tc.id, name: tc.name, result: resultStr };
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            sse.writeToolEnd(tc.id, tc.name, JSON.stringify({ error: errMsg }));
            return { toolCallId: tc.id, name: tc.name, result: JSON.stringify({ error: errMsg }) };
          }
        }),
      );

      // Add tool results to conversation
      for (const tr of toolResults) {
        conversation.push({
          role: "tool",
          content: tr.result,
          tool_call_id: tr.toolCallId,
          name: tr.name,
        });
      }

      sse.writeStepDone(`Step ${step + 1} complete`);

      if (pauseForUser) {
        closeFrame();
        break;
      }

      // Continue the loop — the model will see tool results and decide next step.
      // The frame stays open; no new timeline block opens for this next step.
    }
  } finally {
    // Safety net: close a still-open frame/segment if the loop exited via an
    // unhandled path (e.g. an exception thrown before a normal break/return).
    closeFrame();
    sse.writeDone();
    sse.finalize();
  }
}

/** Generate a chat title using a non-streaming completion. */
export async function generateChatTitle(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<string> {
  const userContent = messages.find((m) => m.role === "user")?.content?.trim() ?? "";
  const assistantContent = messages.find((m) => m.role === "assistant")?.content?.trim() ?? "";

  if (!userContent) return "New Chat";

  const titleMessages: ChatMessage[] = [
    {
      role: "system",
      content: "You write short conversation titles for a chat sidebar. Output ONLY the title (3-6 words). No quotes or labels.",
    },
    {
      role: "user",
      content: [
        userContent ? `User: ${userContent.slice(0, 500)}` : "",
        assistantContent ? `Assistant: ${assistantContent.slice(0, 500)}` : "",
      ].filter(Boolean).join("\n"),
    },
  ];

  try {
    const title = await completeChat({
      model: modelCatalogEnvFromProcess().heliosModel,
      messages: titleMessages,
      temperature: 0.3,
      max_tokens: 48,
      enable_thinking: false,
      signal,
    });
    return title.trim().slice(0, 80);
  } catch {
    // Fallback: derive from user content
    return userContent.slice(0, 50).trim();
  }
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
