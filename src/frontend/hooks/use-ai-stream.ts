"use client";

import { useCallback } from "react";
import { createSseParser, type StreamEvent } from "@/frontend/lib/chat-stream";

export type StreamDeltaHandler = {
  onStart?: () => void;
  onThinkingStart?: () => void;
  onThinkingDelta?: (delta: string) => void;
  onAnswerDelta?: (delta: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  /** Full stream event — use for agent/interleaved segments. */
  onEvent?: (event: StreamEvent) => void;
};

function dispatchStreamEvent(
  event: StreamEvent,
  handlers: StreamDeltaHandler,
): boolean {
  handlers.onEvent?.(event);

  switch (event.type) {
    case "start":
      handlers.onStart?.();
      return false;
    case "thinking_start":
      handlers.onThinkingStart?.();
      return false;
    case "thinking_delta":
      handlers.onThinkingDelta?.(event.delta);
      return false;
    case "answer_delta":
      handlers.onAnswerDelta?.(event.delta);
      return false;
    case "done":
      handlers.onDone?.();
      return true;
    case "error":
      handlers.onError?.(event.message);
      return true;
    default:
      return false;
  }
}

/**
 * Parse chat SSE on the main thread so tokens are not lost when a stream ends.
 */
export function useAiStream() {
  const streamFromResponse = useCallback(
    async (
      response: Response,
      handlers: StreamDeltaHandler,
      signal?: AbortSignal,
    ): Promise<void> => {
      if (!response.ok || !response.body) {
        throw new Error("Failed to generate response");
      }

      let streamComplete = false;
      const parseChunk = createSseParser((event) => {
        if (dispatchStreamEvent(event, handlers)) {
          streamComplete = true;
        }
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          if (signal?.aborted) {
            await reader.cancel();
            break;
          }
          const { value, done } = await reader.read();
          if (done) break;
          parseChunk(decoder.decode(value, { stream: true }));
          if (streamComplete) {
            await reader.cancel();
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    [],
  );

  return { streamFromResponse, dispose: () => {} };
}
