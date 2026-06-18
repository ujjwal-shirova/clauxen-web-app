"use client";

import { useCallback } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { consumeClauxenStreamResponse } from "@/frontend/lib/ui-message-stream";

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
 * Parse Vercel AI SDK UI message streams (hybrid) or legacy Clauxen SSE events.
 */
export function useAiStream() {
  const streamFromResponse = useCallback(
    async (
      response: Response,
      handlers: StreamDeltaHandler,
      signal?: AbortSignal,
    ): Promise<void> => {
      let streamComplete = false;

      await consumeClauxenStreamResponse(
        response,
        (event) => {
          if (dispatchStreamEvent(event, handlers)) {
            streamComplete = true;
          }
        },
        signal,
      );

      if (!streamComplete) {
        handlers.onDone?.();
      }
    },
    [],
  );

  return { streamFromResponse, dispose: () => {} };
}
