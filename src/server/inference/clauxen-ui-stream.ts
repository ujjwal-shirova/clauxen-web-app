const MAX_SSE_BUFFER_BYTES = 512 * 1024;

/** Tap answer/thinking/title/tools from an agent SSE byte stream for DB persistence. */
export function tapUiMessageSseStream(
  source: ReadableStream<Uint8Array>,
  callbacks: {
    onAnswerDelta?: (delta: string) => void;
    onAnswerFinalize?: (text: string) => void;
    onAnswerClear?: () => void;
    onThinkingStart?: () => void;
    onThinkingDelta?: (delta: string) => void;
    onThinkingEnd?: () => void;
    onChatTitle?: (title: string) => void;
    onToolStart?: (tool: {
      toolCallId: string;
      name: string;
      args?: Record<string, unknown>;
      description?: string;
    }) => void;
    onToolEnd?: (tool: {
      toolCallId: string;
      name: string;
      result: string;
      isError?: boolean;
    }) => void;
    onError?: (message: string) => void;
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
        } catch {
          // ignore
        }
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
          if (buffer.length > MAX_SSE_BUFFER_BYTES) {
            buffer = buffer.slice(-MAX_SSE_BUFFER_BYTES / 2);
          }

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const rawEvent of chunks) {
            const dataLine = rawEvent
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            const payload = dataLine.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as {
                type?: string;
                delta?: unknown;
                text?: unknown;
                title?: unknown;
                message?: unknown;
                toolCallId?: unknown;
                name?: unknown;
                args?: unknown;
                description?: unknown;
                result?: unknown;
                isError?: unknown;
              };
              if (
                parsed.type === "answer_finalize" &&
                typeof parsed.text === "string"
              ) {
                callbacks.onAnswerFinalize?.(parsed.text);
              }
              if (
                parsed.type === "answer_delta" &&
                typeof parsed.delta === "string"
              ) {
                callbacks.onAnswerDelta?.(parsed.delta);
              }
              if (parsed.type === "answer_clear") {
                callbacks.onAnswerClear?.();
              }
              if (parsed.type === "thinking_start") {
                callbacks.onThinkingStart?.();
              }
              if (parsed.type === "thinking_delta") {
                if (typeof parsed.delta === "string") {
                  callbacks.onThinkingDelta?.(parsed.delta);
                }
              }
              if (parsed.type === "thinking_end") {
                callbacks.onThinkingEnd?.();
              }
              if (parsed.type === "chat_title") {
                if (typeof parsed.title === "string") {
                  callbacks.onChatTitle?.(parsed.title);
                }
              }
              if (
                parsed.type === "error" &&
                typeof parsed.message === "string"
              ) {
                callbacks.onError?.(parsed.message);
              }
              if (parsed.type === "tool_start") {
                if (
                  typeof parsed.toolCallId === "string" &&
                  typeof parsed.name === "string"
                ) {
                  callbacks.onToolStart?.({
                    toolCallId: parsed.toolCallId,
                    name: parsed.name,
                    args:
                      parsed.args &&
                      typeof parsed.args === "object" &&
                      !Array.isArray(parsed.args)
                        ? (parsed.args as Record<string, unknown>)
                        : {},
                    description:
                      typeof parsed.description === "string"
                        ? parsed.description
                        : undefined,
                  });
                }
              }
              if (parsed.type === "tool_end") {
                if (
                  typeof parsed.toolCallId === "string" &&
                  typeof parsed.name === "string"
                ) {
                  callbacks.onToolEnd?.({
                    toolCallId: parsed.toolCallId,
                    name: parsed.name,
                    result:
                      typeof parsed.result === "string" ? parsed.result : "",
                    isError:
                      typeof parsed.isError === "boolean"
                        ? parsed.isError
                        : undefined,
                  });
                }
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
