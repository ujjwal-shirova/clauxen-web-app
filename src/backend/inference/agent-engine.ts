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
  file_read: z.object({
    path: z.string(),
  }),
  file_write: z.object({
    path: z.string(),
    content: z.string(),
  }),
  ask_user_clarification: z.object({
    question: z.string(),
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

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal?.aborted) {
        sse.writeError("Generation aborted.");
        return;
      }

      let frameOpen = false;
      let frameId = `agent-frame-${step + 1}`;
      let interimBuffer = "";
      let sawToolCall = false;
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      let fullText = "";
      let fullReasoning = "";

      const openFrame = () => {
        if (frameOpen) return;
        sse.writeFrameStart(frameId);
        frameOpen = true;
      };

      const closeFrame = () => {
        if (!frameOpen) return;
        if (interimBuffer.trim()) {
          sse.writeInterim(interimBuffer.trim());
          interimBuffer = "";
        }
        sse.writeFrameComplete(frameId);
        frameOpen = false;
      };

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
            // Stream live so the user sees real-time typing. If a tool call
            // arrives later, we retract this text from the answer and capture
            // it as the frame's interim narrative instead.
            if (!sawToolCall) {
              sse.writeAnswerDelta(visible);
            } else {
              // Text after tool calls in the same step is interim narrative.
              // Emit the full accumulated buffer so the frame's live narrative
              // updates in place (avoids fragmented \n\n appends).
              interimBuffer += visible;
              sse.writeInterim(interimBuffer.trim());
            }
            fullText += visible;
            break;
          }

          case "tool-call-start":
            if (!sawToolCall) {
              // Retract the streamed pre-tool text from the answer buffer —
              // it was narration, not the final answer. Capture it as the
              // frame's interim narrative instead. Open the frame FIRST so the
              // reducer has a frame to attach the interim to.
              openFrame();
              sawToolCall = true;
              if (fullText.trim()) {
                sse.writeAnswerClear();
                sse.writeInterim(fullText.trim());
                // Seed the interim buffer with the pre-tool narrative so
                // subsequent post-tool text appends to it seamlessly.
                interimBuffer = fullText.trim();
              }
            }
            sse.writeToolStart(part.toolCallId, part.toolName);
            break;

          case "tool-call-delta":
            // We could stream partial args to the UI, but for now we buffer
            // and emit the full args on tool-call-end.
            break;

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
            sse.writeError(part.error);
            return;

          case "abort":
            closeFrame();
            sse.writeError("Generation aborted.");
            return;
        }
      }

      // Close any open frame before processing tools
      if (frameOpen && sawToolCall) {
        if (interimBuffer.trim()) {
          sse.writeInterim(interimBuffer.trim());
          interimBuffer = "";
        }
        sse.writeFrameComplete(frameId);
        frameOpen = false;
      } else if (frameOpen) {
        closeFrame();
      }

      // If thinking was streaming and we have text, end thinking
      if (fullReasoning && fullText) {
        sse.writeThinkingEnd();
      }

      // If no tool calls, we're done — the text is the final answer
      if (pendingToolCalls.length === 0) {
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

      // Execute tool calls in parallel (independent calls run concurrently)
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

      // Continue the loop — the model will see tool results and decide next step
    }
  } finally {
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
