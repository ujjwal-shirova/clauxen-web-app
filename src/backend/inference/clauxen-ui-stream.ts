import { ClauxenUiStreamWriter } from "@/backend/inference/clauxen-ui-stream-writer";
import type { ClauxenUIMessage } from "@/lib/clauxen-ui-message";

const MAX_SSE_BUFFER_BYTES = 512 * 1024;

/**
 * Create a Clauxen UI message stream using our own SSE stream (no AI SDK).
 * Returns a ReadableStream<Uint8Array> of SSE bytes.
 */
export function createClauxenUiMessageStream(
  execute: (bridge: ClauxenUiStreamWriter) => Promise<void> | void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let writerResolve: ((writer: ClauxenUiStreamWriter) => void) | null = null;
  const writerPromise = new Promise<ClauxenUiStreamWriter>((resolve) => {
    writerResolve = resolve;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const bridge = new ClauxenUiStreamWriter({
        enqueue: (chunk: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        },
        close: () => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
        error: (err: unknown) => {
          try {
            controller.error(err);
          } catch {
            // already errored
          }
        },
      });
      writerResolve?.(bridge);
      try {
        await execute(bridge);
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          // already errored
        }
      }
    },
  });

  // Suppress unused warning — writerPromise is available if callers need it
  void writerPromise;
  return stream;
}

/** Encode a UI message chunk as SSE bytes — passthrough, no buffering. */
export function encodeUiMessageStreamToBytes(
  stream: ReadableStream<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return stream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      },
    }),
  );
}

/** Tap answer/thinking/title/tools from a UI message SSE byte stream for DB persistence. */
export function tapUiMessageSseStream(
  source: ReadableStream<Uint8Array>,
  callbacks: {
    onAnswerDelta?: (delta: string) => void;
    onThinkingDelta?: (delta: string) => void;
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
    }) => void;
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
                title?: unknown;
                data?: { title?: string };
                toolCallId?: unknown;
                name?: unknown;
                args?: unknown;
                description?: unknown;
                result?: unknown;
              };
              if (
                parsed.type === "text-delta" &&
                typeof parsed.delta === "string"
              ) {
                callbacks.onAnswerDelta?.(parsed.delta);
              }
              if (
                parsed.type === "reasoning-delta" &&
                typeof parsed.delta === "string"
              ) {
                callbacks.onThinkingDelta?.(parsed.delta);
              }
              if (parsed.type === "data-chat-title") {
                const title = parsed.data?.title;
                if (typeof title === "string") {
                  callbacks.onChatTitle?.(title);
                }
              }
              if (parsed.type === "answer_delta") {
                if (typeof parsed.delta === "string") {
                  callbacks.onAnswerDelta?.(parsed.delta);
                }
              }
              if (parsed.type === "thinking_delta") {
                if (typeof parsed.delta === "string") {
                  callbacks.onThinkingDelta?.(parsed.delta);
                }
              }
              if (parsed.type === "chat_title") {
                if (typeof parsed.title === "string") {
                  callbacks.onChatTitle?.(parsed.title);
                }
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
