import { env } from "@/backend/config/env";
import {
  buildAnthropicChatParams,
  consumeAnthropicMessageStream,
  convertIncomingToAnthropic,
  extractAnthropicText,
} from "@/backend/inference/anthropic-adapter";
import { getAnthropicClient } from "@/backend/inference/anthropic-client";
import {
  buildTitlePromptPayload,
  deriveTitleFromExchange,
  normalizeChatTitle,
  type TitleExchange,
} from "@/lib/chat-title";

export type ChatRole = "user" | "assistant" | "system";
export type IncomingMessage = { role: ChatRole; content: string };

export type ThinkingType = "enabled" | "disabled";

export function resolveThinkingType(input?: {
  thinkingEnabled?: boolean;
  thinkingType?: string;
}): ThinkingType {
  if (input?.thinkingEnabled === true) return "enabled";
  if (input?.thinkingEnabled === false) return "disabled";
  if (input?.thinkingType === "enabled") return "enabled";
  return "disabled";
}

export type AgentSegmentKind = "thinking" | "text" | "tool";

export type ChatStreamEvent =
  | { type: "start"; agentMode?: boolean }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string; segmentId?: string }
  | { type: "thinking_end"; segmentId?: string }
  | { type: "segment_start"; segmentId: string; kind: AgentSegmentKind }
  | { type: "segment_end"; segmentId: string; kind: AgentSegmentKind }
  | { type: "answer_delta"; delta: string; segmentId?: string }
  | {
      type: "tool_start";
      toolCallId: string;
      name: string;
      args?: Record<string, unknown>;
      description?: string;
    }
  | {
      type: "tool_output_delta";
      toolCallId: string;
      kind: "stdout" | "stderr";
      delta: string;
    }
  | { type: "tool_data"; toolCallId: string; data: Record<string, unknown> }
  | {
      type: "tool_end";
      toolCallId: string;
      name: string;
      result: string;
    }
  | { type: "step_done"; label?: string }
  | { type: "agent_frame_complete" }
  | { type: "done" }
  | { type: "error"; message: string };

export function encodeSseEvent(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function sanitizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((message: unknown): message is IncomingMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as { role?: unknown; content?: unknown };
      return (
        typeof candidate.role === "string" &&
        typeof candidate.content === "string" &&
        ["user", "assistant", "system"].includes(candidate.role)
      );
    })
    .map((message) => ({ role: message.role, content: message.content }));
}

export function extractUpstreamError(body: unknown, fallback: string) {
  const candidate = body as {
    error?: { message?: unknown; type?: unknown } | string;
    message?: unknown;
  };

  if (typeof candidate?.error === "string") return candidate.error;
  if (
    candidate?.error &&
    typeof candidate.error === "object" &&
    typeof candidate.error.message === "string"
  ) {
    return candidate.error.message;
  }
  if (typeof candidate?.message === "string") return candidate.message;
  return fallback;
}

export type AnthropicChatRequestOptions = {
  stream?: boolean;
  thinkingType?: ThinkingType;
  maxTokens?: number;
};

export async function streamAnthropicChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: Pick<AnthropicChatRequestOptions, "thinkingType">,
) {
  const client = getAnthropicClient();
  return client.messages.stream(
    buildAnthropicChatParams(messages, {
      stream: true,
      thinkingType: options?.thinkingType,
    }),
    { signal },
  );
}

function titleExchangeFromMessages(messages: IncomingMessage[]): TitleExchange {
  return {
    userContent:
      messages.find((message) => message.role === "user")?.content ?? "",
    assistantContent:
      messages.find((message) => message.role === "assistant")?.content ?? "",
  };
}

export function deriveTitleFallback(messages: IncomingMessage[]): string {
  const exchange = titleExchangeFromMessages(messages);
  return deriveTitleFromExchange(
    exchange.userContent,
    exchange.assistantContent,
  );
}

export function sanitizeGeneratedTitle(
  raw: string,
  exchange: TitleExchange,
): string {
  return normalizeChatTitle(raw, exchange);
}

/** Title requests never use thinking — answer text only. */
export function buildAnthropicTitleParams(messages: IncomingMessage[]) {
  const exchange = titleExchangeFromMessages(messages);
  const { system, messages: anthropicMessages } = convertIncomingToAnthropic([
    {
      role: "system",
      content: [
        "You write short conversation titles for a chat sidebar.",
        "Rules:",
        "- Output ONLY the title (3-6 words)",
        "- No quotes, markdown, labels, or explanation",
        "- Summarize the topic; do NOT copy the user's message verbatim",
        '- Example: User asks about React useEffect loops → "React useEffect loop fix"',
      ].join("\n"),
    },
    {
      role: "user",
      content: buildTitlePromptPayload(exchange),
    },
  ]);

  return {
    model: env.defaultModel,
    system,
    messages: anthropicMessages,
    max_tokens: 48,
    temperature: 0.3,
  };
}

export async function generateAnthropicTitle(messages: IncomingMessage[]) {
  const exchange = titleExchangeFromMessages(messages);
  const fallbackTitle = deriveTitleFromExchange(
    exchange.userContent,
    exchange.assistantContent,
  );

  const client = getAnthropicClient();
  const titleParams = buildAnthropicTitleParams(messages);
  const response = await client.messages.create(titleParams);
  const answer = extractAnthropicText(response.content).trim();
  if (answer) {
    return sanitizeGeneratedTitle(answer, exchange);
  }

  return fallbackTitle;
}

/** Pass-through for agent/chat SSE while tapping answer/thinking deltas for persistence. */
export function tapChatSseStream(
  source: ReadableStream<Uint8Array>,
  callbacks: {
    onAnswerDelta?: (delta: string) => void;
    onThinkingDelta?: (delta: string) => void;
  },
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();

      const onAbort = () => {
        try {
          reader.cancel();
        } catch (_) {}
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          controller.close();
          return;
        }
        signal.addEventListener("abort", onAbort);
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);

          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 512 * 1024) {
            buffer = buffer.slice(-256 * 1024);
          }
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const rawEvent of chunks) {
            const dataLine = rawEvent
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const parsed = JSON.parse(dataLine.slice(6)) as {
                type?: string;
                delta?: string;
              };
              if (parsed.type === "answer_delta" && typeof parsed.delta === "string") {
                callbacks.onAnswerDelta?.(parsed.delta);
              }
              if (
                parsed.type === "thinking_delta" &&
                typeof parsed.delta === "string"
              ) {
                callbacks.onThinkingDelta?.(parsed.delta);
              }
            } catch {
              continue;
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    },
  });
}

export function transformAnthropicStream(
  stream: AsyncIterable<import("@anthropic-ai/sdk/resources/messages").RawMessageStreamEvent>,
  onAnswerDelta: (delta: string) => void,
  onThinkingDelta: (delta: string) => void,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  let thinking = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        new TextEncoder().encode(encodeSseEvent({ type: "start" })),
      );

      try {
        await consumeAnthropicMessageStream(
          stream,
          {
            onThinkingDelta: (delta) => {
              if (!thinking) {
                thinking = true;
                controller.enqueue(
                  new TextEncoder().encode(
                    encodeSseEvent({ type: "thinking_start" }),
                  ),
                );
              }
              onThinkingDelta(delta);
              controller.enqueue(
                new TextEncoder().encode(
                  encodeSseEvent({ type: "thinking_delta", delta }),
                ),
              );
            },
            onTextDelta: (delta) => {
              onAnswerDelta(delta);
              controller.enqueue(
                new TextEncoder().encode(
                  encodeSseEvent({ type: "answer_delta", delta }),
                ),
              );
            },
          },
          signal,
        );

        controller.enqueue(
          new TextEncoder().encode(encodeSseEvent({ type: "done" })),
        );
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Stream failed.";
        controller.enqueue(
          new TextEncoder().encode(encodeSseEvent({ type: "error", message })),
        );
        controller.close();
      }
    },
  });
}
