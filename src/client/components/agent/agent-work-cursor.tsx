"use client";

import { AgentMorphDots } from "./agent-morph-dots";

/**
 * Bottom-of-turn work cursor — the morphing dot cluster that sits at the
 * bottom of the assistant message while the turn is live. It stays pinned
 * under the output while the final answer streams, acting like a text cursor
 * marking where new output is still landing, and disappears when the turn
 * completes.
 */
export function AgentWorkCursor({
  label = "Assistant is working",
}: {
  label?: string;
}) {
  return (
    <div
      className="agent-work-cursor"
      role="status"
      aria-live="polite"
      data-agent-work-cursor="true"
    >
      <AgentMorphDots active />
      <span className="sr-only">{label}</span>
    </div>
  );
}
