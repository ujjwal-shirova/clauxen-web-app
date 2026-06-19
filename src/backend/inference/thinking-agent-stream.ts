import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeAutonomousTool } from "@/backend/inference/autonomous-tools/executor";
import { autonomousToolsToOpenAi } from "@/backend/inference/autonomous-tools/openai-tools";
import {
  createClauxenUiMessageStream,
  encodeUiMessageStreamToBytes,
} from "@/backend/inference/clauxen-ui-stream";
import { ClauxenUiStreamWriter } from "@/backend/inference/clauxen-ui-stream-writer";
import {
  createToolEventSender,
  type AiSdkToolContext,
} from "@/backend/inference/ai-sdk-tool-kit";
import { getOpenAIClient } from "@/backend/inference/openai-client";
import { NOVITA_STREAM_OPTIONS } from "@/backend/inference/novita-stream";
import type { IncomingMessage } from "@/backend/inference/novita";
import {
  appendAssistantTurn,
  appendToolResults,
  incomingMessagesToOpenAi,
  type AssistantTurn,
  type ReasoningToolCall,
} from "@/backend/inference/reasoning-message-history";
import {
  buildCacheableSystemPrefix,
  orderMessagesForPromptCache,
} from "@/backend/inference/prompt-cache";
import { buildThinkingAgentSystemPrompt } from "@/backend/inference/agent-system-prompt";
import { inferLanguage } from "@/backend/inference/platform-tools";

const MAX_THINKING_ROUNDS = 25;
const DEFAULT_MAX_TOKENS = 8192;

// System prompt behaviour is centralised in agent-system-prompt.ts.
// For the thinking-agent path, buildThinkingAgentSystemPrompt() returns null
// (no system message) by design — see that file for the rationale.

type NovitaStreamDelta = {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

type NovitaStreamMessage = {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: unknown[];
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ThinkingAgentStreamOptions = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  model?: string;
  baseUrl?: string;
};

function wireThinkingToolEvents(
  bridge: ClauxenUiStreamWriter,
  send: ReturnType<typeof createToolEventSender>,
) {
  return (event: string, data: Record<string, unknown>) => {
    if (event === "web_search_results" || event === "tool_progress") {
      bridge.onToolData(data);
      return;
    }
    if (event === "clarification" && typeof data.question === "string") {
      bridge.onAnswerDelta(`\n\n**Clarification needed:** ${data.question}\n`);
      return;
    }
    if (event === "file_created") {
      bridge.onArtifact({
        path: String(data.path ?? ""),
        content: String(data.content ?? ""),
        language: typeof data.language === "string" ? data.language : undefined,
        description:
          typeof data.description === "string" ? data.description : undefined,
      });
      return;
    }
    send(event, data);
  };
}

function collectToolCalls(
  pendingByIndex: Map<number, PendingToolCall>,
): ReasoningToolCall[] {
  return [...pendingByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call)
    .filter((call) => call.id && call.name)
    .map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.name,
        arguments: call.arguments,
      },
    }));
}

function formatToolOutput(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output ?? {});
}

function formatToolError(error: unknown): string {
  return JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Thinking-mode agent loop with native Novita interleaved reasoning round-trip.
 * No system prompt — tool schemas are the only steering.
 */
export function streamThinkingAgentChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: ThinkingAgentStreamOptions = {},
): ReadableStream<Uint8Array> {
  const uiStream = createClauxenUiMessageStream(async (bridge) => {
    bridge.writeStart(true);

    const toolContext: AiSdkToolContext = {
      userId: options.userId,
      conversationId: options.conversationId,
      userCountryCode: options.userCountryCode,
    };

    const baseSend = createToolEventSender((event, data) => {
      if (event === "tool_executing") {
        bridge.onToolExecuting({
          tool_call_id: String(data.tool_call_id ?? ""),
          name: String(data.name ?? ""),
          args:
            data.args && typeof data.args === "object"
              ? (data.args as Record<string, unknown>)
              : {},
          description:
            typeof data.description === "string" ? data.description : undefined,
        });
        return;
      }
      if (event === "tool_result") {
        bridge.onToolResult({
          tool_call_id: String(data.tool_call_id ?? ""),
          name: String(data.name ?? ""),
          result: String(data.result ?? ""),
        });
        return;
      }
    });

    const send = wireThinkingToolEvents(bridge, baseSend);
    const openAiTools = autonomousToolsToOpenAi();
    const client = getOpenAIClient(options.baseUrl);
    const model = options.model?.trim() || "";

    // Strip and order messages for best prompt-cache hit rate.
    let baseConversation: ChatCompletionMessageParam[] =
      incomingMessagesToOpenAi(messages);

    // For the thinking-agent path, buildThinkingAgentSystemPrompt() returns null —
    // we deliberately send NO system message so the model's own reasoning (native
    // thinking tokens) and the tool descriptions drive behaviour entirely.
    // This gives the fastest first-token and the most natural autonomous flow.
    const thinkingSystemContent = buildThinkingAgentSystemPrompt();

    const incomingSystemMessages = baseConversation.filter(
      (m): m is Extract<ChatCompletionMessageParam, { role: "system" }> =>
        m.role === "system",
    );
    const conversationMessages = baseConversation.filter(
      (m) => m.role !== "system",
    );

    let conversation: ChatCompletionMessageParam[];
    if (thinkingSystemContent !== null) {
      // A system prompt was requested (e.g. in a future variant) — prepend it,
      // merging any incoming system messages for clean cache ordering.
      const mergedContent = [
        buildCacheableSystemPrefix(thinkingSystemContent),
        ...incomingSystemMessages.map((m) => String(m.content)),
      ]
        .filter(Boolean)
        .join("\n\n");
      const systemMsg: ChatCompletionMessageParam = {
        role: "system",
        content: mergedContent,
      };
      conversation = orderMessagesForPromptCache(
        [systemMsg],
        conversationMessages as any,
      );
    } else {
      // No system message — pass only the conversation turns.
      conversation = incomingSystemMessages.length
        ? orderMessagesForPromptCache(
            incomingSystemMessages,
            conversationMessages as any,
          )
        : conversationMessages;
    }

    // Only attach the full (potentially large) autonomous tool definitions when the model
    // actually needs to choose/call tools. This avoids bloating every Novita request and
    // helps keep prompt cache prefixes stable (tool schemas won't vary the request shape unnecessarily).
    let shouldSendTools = true;

    let workFrameOpen = false;
    let frameCounter = 0;
    let reasoningOpen = false;

    const nextFrameId = () => {
      frameCounter += 1;
      return `frame-${frameCounter}`;
    };

    const ensureWorkFrame = () => {
      if (workFrameOpen) return;
      bridge.onFrameStart(nextFrameId());
      workFrameOpen = true;
    };

    const closeReasoning = () => {
      if (!reasoningOpen) return;
      bridge.onReasoningEnd();
      reasoningOpen = false;
    };

    const closeWorkFrame = () => {
      if (!workFrameOpen) return;
      bridge.onFrameComplete();
      workFrameOpen = false;
    };

    // Autonomy phase tracking:
    // - hasPerformedToolWork: at least one tool was used in this agent turn.
    // - inFinalAnswerPhase: once a round completes with 0 tool calls, all its (and future) content is the final answer.
    // This prevents creating extra "work frames" for the final user-facing output and avoids capturing final text as interim.
    let hasPerformedToolWork = false;
    let inFinalAnswerPhase = false;

    try {
      for (let round = 0; round < MAX_THINKING_ROUNDS; round += 1) {
        if (signal?.aborted) break;

        const lastForTools = conversation[conversation.length - 1];
        // Send large tool catalog only for rounds where model is expected to decide on tool use.
        // After tool results (role=tool) or initial user, include. Once model has answered without tools we break anyway.
        const attachTools =
          shouldSendTools &&
          (!lastForTools ||
            lastForTools.role === "user" ||
            lastForTools.role === "tool");

        const stream = await client.chat.completions.create(
          {
            model,
            messages: conversation,
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: 1,
            ...(attachTools ? { tools: openAiTools, tool_choice: "auto" } : {}),
            ...NOVITA_STREAM_OPTIONS,
          },
          { signal },
        );

        const pendingByIndex = new Map<number, PendingToolCall>();
        let assistantContent = "";
        let reasoningContent = "";
        let reasoningDetails: unknown[] | undefined;

        for await (const chunk of stream) {
          if (signal?.aborted) break;

          const choice = chunk.choices[0];
          const delta = choice?.delta as NovitaStreamDelta | undefined;
          if (!delta) continue;

          if (delta.reasoning_content) {
            reasoningContent += delta.reasoning_content;
            ensureWorkFrame();
            reasoningOpen = true;
            bridge.onReasoningDelta(delta.reasoning_content);
          }

          if (delta.content) {
            closeReasoning();
            // For autonomy: only open a work frame for "progress narrative" if we are still in the tool-using exploration phase.
            // Once we enter final answer phase (or for very first content before any tools), stream straight to the visible answer.
            // This lets the model emit natural sentences like "let me search..." and later "I have the results, here is the summary..."
            // without polluting the final answer area or creating an extra trailing work frame.
            if (!inFinalAnswerPhase && hasPerformedToolWork) {
              ensureWorkFrame();
            }
            assistantContent += delta.content;
            bridge.onAnswerDelta(delta.content);
          }

          if (delta.tool_calls) {
            closeReasoning();
            hasPerformedToolWork = true;
            ensureWorkFrame();
            for (const toolDelta of delta.tool_calls) {
              const index = toolDelta.index ?? 0;
              const current = pendingByIndex.get(index) ?? {
                id: toolDelta.id ?? "",
                name: toolDelta.function?.name ?? "",
                arguments: "",
              };
              if (toolDelta.id) current.id = toolDelta.id;
              if (toolDelta.function?.name) {
                current.name = toolDelta.function.name;
              }
              if (toolDelta.function?.arguments) {
                current.arguments += toolDelta.function.arguments;
              }
              pendingByIndex.set(index, current);

              bridge.onToolStreaming({
                tool_calls: [
                  {
                    id: current.id,
                    name: current.name,
                    input: current.arguments,
                  },
                ],
              });
            }
          }

          const chunkMessage = (choice as { message?: NovitaStreamMessage })
            ?.message;
          if (chunkMessage?.reasoning_details?.length) {
            reasoningDetails = chunkMessage.reasoning_details;
          }
          if (chunkMessage?.reasoning_content && !reasoningContent) {
            reasoningContent = chunkMessage.reasoning_content;
          }
        }

        closeReasoning();

        const toolCalls = collectToolCalls(pendingByIndex);
        if (toolCalls.length === 0) {
          inFinalAnswerPhase = true;
          // Close any open work frame from the exploration phase.
          // The content accumulated in this round (if any) is the model's final answer.
          closeWorkFrame();
          break;
        }

        const assistantTurn: AssistantTurn = {
          content: assistantContent || null,
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
          ...(reasoningDetails?.length
            ? { reasoning_details: reasoningDetails }
            : {}),
          tool_calls: toolCalls,
        };

        conversation = appendAssistantTurn(conversation, assistantTurn);
        bridge.onStepDone();

        const toolResults: Array<{ tool_call_id: string; content: string }> =
          [];

        for (const call of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }

          bridge.onToolExecuting({
            tool_call_id: call.id,
            name: call.function.name,
            args,
          });

          let resultText: string;
          try {
            const outcome = await executeAutonomousTool(
              call.function.name,
              args,
              {
                conversationId: toolContext.conversationId ?? "chat",
                userId: toolContext.userId,
                userCountryCode: toolContext.userCountryCode,
                toolCallId: call.id,
                onToolProgress: (data) => {
                  send("tool_progress", {
                    tool_call_id: call.id,
                    ...data,
                  });
                },
              },
            );

            if (call.function.name === "web_search") {
              send("web_search_results", {
                tool_call_id: call.id,
                ...(typeof outcome.output === "object" && outcome.output
                  ? (outcome.output as Record<string, unknown>)
                  : {}),
              });
            }

            if (call.function.name === "file_write") {
              const payload = outcome.output as {
                path?: string;
                content?: string;
              };
              if (payload?.path && payload.content != null) {
                send("file_created", {
                  path: payload.path,
                  content: payload.content,
                  language: inferLanguage(payload.path),
                });
              }
            }

            if (outcome.pauseForUser && outcome.clarificationQuestion) {
              send("clarification", {
                question: outcome.clarificationQuestion,
              });
            }

            resultText = formatToolOutput(outcome.output);
          } catch (error) {
            resultText = formatToolError(error);
          }

          bridge.onToolResult({
            tool_call_id: call.id,
            name: call.function.name,
            result: resultText,
          });

          toolResults.push({
            tool_call_id: call.id,
            content: resultText,
          });
        }

        conversation = appendToolResults(conversation, toolResults);
        // Finished this work round. Close the frame; next round may produce more progress text or the final answer.
        closeWorkFrame();
      }

      // Ensure everything is closed and the final answer (if any) has been streamed via answer deltas.
      closeReasoning();
      closeWorkFrame();
      bridge.finalize();
    } catch (error) {
      if (signal?.aborted) {
        bridge.finalize();
        return;
      }
      bridge.onError(
        error instanceof Error ? error.message : "Thinking agent failed",
      );
      bridge.finalize();
    }
  });

  return encodeUiMessageStreamToBytes(uiStream);
}
