"use client";

import { useCallback, useRef, useState } from "react";
import {
  collapseReasoningItems,
  initialAgentRunState,
  reduceAgentEvent,
  type AgentRunState,
} from "@/autonomous-agent/client/stream-reducer";
import type { NormalizedEvent } from "@/autonomous-agent/types/events";
import { parseEvent } from "@/autonomous-agent/types/events";

type UseAutonomousAgentStreamOptions = {
  conversationId: string | null;
  onConversationId?: (id: string) => void;
};

/**
 * Hook for consuming the autonomous-agent SSE API (normalized events).
 * Used by integrations/tests — main chat uses Clauxen UI stream via /api/chat.
 */
export function useAutonomousAgentStream({
  conversationId,
  onConversationId,
}: UseAutonomousAgentStreamOptions) {
  const [runState, setRunState] = useState<AgentRunState>(initialAgentRunState);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const eventCountRef = useRef(0);

  const applyEvent = useCallback((event: NormalizedEvent) => {
    eventCountRef.current += 1;
    setRunState((prev) => reduceAgentEvent(prev, event));

    if (event.type === "ReasoningEnd") {
      const id = event.messageId;
      window.setTimeout(() => {
        setRunState((prev) => ({
          ...prev,
          items: collapseReasoningItems(prev.items, id),
        }));
      }, 1200);
    }
  }, []);

  const consumeSseStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const parsed = parseEvent(line.slice(6));
          if (parsed) applyEvent(parsed);
        }
      }
    },
    [applyEvent],
  );

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId;
    const res = await fetch("/api/autonomous-agent/conversations", {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    const data = (await res.json()) as { id: string };
    onConversationId?.(data.id);
    return data.id;
  }, [conversationId, onConversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setRunState((prev) => ({
        ...initialAgentRunState,
        items: prev.items,
      }));

      try {
        const id = await ensureConversation();
        const fromEventIndex = eventCountRef.current;

        const res = await fetch(
          `/api/autonomous-agent/conversations/${id}/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: trimmed, fromEventIndex }),
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error ?? `Stream failed (${res.status})`);
        }

        await consumeSseStream(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          applyEvent({
            type: "RunError",
            conversationId: conversationId ?? "unknown",
            message: err instanceof Error ? err.message : String(err),
            timestamp: Date.now(),
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      applyEvent,
      consumeSseStream,
      conversationId,
      ensureConversation,
      isStreaming,
    ],
  );

  const reconnect = useCallback(async () => {
    if (!conversationId) return;
    const res = await fetch(
      `/api/autonomous-agent/conversations/${conversationId}/stream?fromEventIndex=${eventCountRef.current}`,
    );
    if (!res.ok) return;
    await consumeSseStream(res);
  }, [conversationId, consumeSseStream]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setRunState(initialAgentRunState);
    eventCountRef.current = 0;
  }, [stop]);

  return {
    runState,
    isStreaming,
    sendMessage,
    reconnect,
    stop,
    reset,
  };
}
