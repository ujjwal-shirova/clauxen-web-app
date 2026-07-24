import type { StreamEvent } from "@/lib/chat-stream";

/** Merge consecutive delta events so one frame flush = one reducer pass. */
export function coalesceStreamEvents(events: StreamEvent[]): StreamEvent[] {
  const merged: StreamEvent[] = [];

  for (const event of events) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      event.type === "answer_delta" &&
      prev.type === "answer_delta"
    ) {
      merged[merged.length - 1] = {
        type: "answer_delta",
        delta: prev.delta + event.delta,
      };
      continue;
    }

    if (
      prev &&
      event.type === "thinking_delta" &&
      prev.type === "thinking_delta" &&
      prev.segmentId === event.segmentId
    ) {
      merged[merged.length - 1] = {
        ...prev,
        delta: prev.delta + event.delta,
      };
      continue;
    }

    if (
      prev &&
      event.type === "narration_delta" &&
      prev.type === "narration_delta" &&
      prev.segmentId === event.segmentId
    ) {
      merged[merged.length - 1] = {
        ...prev,
        delta: prev.delta + event.delta,
      };
      continue;
    }

    if (
      prev &&
      event.type === "tool_output_delta" &&
      prev.type === "tool_output_delta" &&
      prev.toolCallId === event.toolCallId &&
      prev.kind === event.kind
    ) {
      merged[merged.length - 1] = {
        ...prev,
        delta: prev.delta + event.delta,
      };
      continue;
    }

    merged.push(event);
  }

  return merged;
}

/** ponytail: one rAF flush caps React commits at display refresh rate. */
export function createStreamEventBatcher(options: {
  onFlush: (events: StreamEvent[]) => void;
}) {
  let queue: StreamEvent[] = [];
  let rafId: number | null = null;

  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    options.onFlush(coalesceStreamEvents(batch));
  };

  const push = (event: StreamEvent) => {
    queue.push(event);
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (queue.length === 0) return;
      const batch = queue;
      queue = [];
      options.onFlush(coalesceStreamEvents(batch));
    });
  };

  const dispose = () => {
    flush();
  };

  return { push, flush, dispose };
}
