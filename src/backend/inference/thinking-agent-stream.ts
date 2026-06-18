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
import { inferLanguage } from "@/backend/inference/platform-tools";

const MAX_THINKING_ROUNDS = 25;
const DEFAULT_MAX_TOKENS = 8192;

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
        language:
          typeof data.language === "string" ? data.language : undefined,
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

    let conversation: ChatCompletionMessageParam[] =
      incomingMessagesToOpenAi(messages);

    try {
      for (let round = 0; round < MAX_THINKING_ROUNDS; round += 1) {
        if (signal?.aborted) break;

        const stream = await client.chat.completions.create(
          {
            model,
            messages: conversation,
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: 1,
            tools: openAiTools,
            tool_choice: "auto",
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
            bridge.onReasoningDelta(delta.reasoning_content);
          }

          if (delta.content) {
            assistantContent += delta.content;
            bridge.onAnswerDelta(delta.content);
          }

          if (delta.tool_calls) {
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

        const toolCalls = collectToolCalls(pendingByIndex);
        if (toolCalls.length === 0) {
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
            send("clarification", { question: outcome.clarificationQuestion });
          }

          const resultText = formatToolOutput(outcome.output);
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
      }

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
