import {
  createUIMessageStream,
  JsonToSseTransformStream,
  type UIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";
import { ClauxenUiStreamWriter } from "@/backend/inference/clauxen-ui-stream-writer";
import type { ClauxenUIMessage } from "@/lib/clauxen-ui-message";

const MAX_SSE_BUFFER_BYTES = 512 * 1024;

export function createClauxenUiMessageStream(
  execute: (bridge: ClauxenUiStreamWriter) => Promise<void> | void,
) {
  return createUIMessageStream<ClauxenUIMessage>({
    execute: ({ writer }) => {
      const bridge = new ClauxenUiStreamWriter(
        writer as UIMessageStreamWriter<ClauxenUIMessage>,
      );
      return execute(bridge);
    },
  });
}

/** Encode AI SDK UI message chunks as SSE bytes — passthrough, no buffering. */
export function encodeUiMessageStreamToBytes(
  stream: ReadableStream<UIMessageChunk>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return stream
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(encoder.encode(chunk));
        },
      }),
    );
}

/** Tap answer/thinking/title from a UI message SSE byte stream for DB persistence. */
export function tapUiMessageSseStream(
  source: ReadableStream<Uint8Array>,
  callbacks: {
    onAnswerDelta?: (delta: string) => void;
    onThinkingDelta?: (delta: string) => void;
    onChatTitle?: (title: string) => void;
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
              const parsed = JSON.parse(payload) as { type?: string };
              if (
                parsed.type === "text-delta" &&
                typeof (parsed as { delta?: unknown }).delta === "string"
              ) {
                callbacks.onAnswerDelta?.(
                  (parsed as { delta: string }).delta,
                );
              }
              if (
                parsed.type === "reasoning-delta" &&
                typeof (parsed as { delta?: unknown }).delta === "string"
              ) {
                callbacks.onThinkingDelta?.(
                  (parsed as { delta: string }).delta,
                );
              }
              if (parsed.type === "data-chat-title") {
                const title = (parsed as { data?: { title?: string } }).data
                  ?.title;
                if (typeof title === "string") {
                  callbacks.onChatTitle?.(title);
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
