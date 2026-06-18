import type { NormalizedEvent } from "@/autonomous-agent/types/events";
import { serializeEvent, stamp } from "@/autonomous-agent/types/events";

/** SSE encoder for Next.js streaming responses. */
export function encodeSseEvent(event: NormalizedEvent): string {
  return `data: ${serializeEvent(event)}\n\n`;
}

export function encodeSseComment(comment: string): string {
  return `: ${comment}\n\n`;
}

export function createSseSink(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): {
  send: (event: NormalizedEvent) => void;
  isOpen: () => boolean;
  close: () => void;
} {
  let open = true;

  return {
    send(event: NormalizedEvent) {
      if (!open) return;
      try {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      } catch {
        open = false;
      }
    },
    isOpen() {
      return open;
    },
    close() {
      if (!open) return;
      open = false;
      try {
        controller.close();
      } catch {
        // Already closed.
      }
    },
  };
}

export function createSnapshotEvent(
  conversationId: string,
  runId: string | null,
  events: NormalizedEvent[],
): NormalizedEvent {
  return stamp({
    type: "Snapshot",
    conversationId,
    runId,
    events,
  });
}
