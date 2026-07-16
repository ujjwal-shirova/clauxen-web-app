"use client";

import { cn } from "@/frontend/lib/utils";
import type { AgentTextSegment } from "@/frontend/lib/agent-segments";
import { AgentTimelineStep } from "./agent-timeline";

/**
 * Short narrative the model emits between tool calls — Cursor-style body copy
 * in the work log (no icon box).
 */
export function AgentNarrativeStep({
  segment,
}: {
  segment: AgentTextSegment;
}) {
  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  return (
    <AgentTimelineStep
      icon="thinking"
      isActive={!!segment.isStreaming}
      title={
        <span
          className={cn(
            "font-[430] leading-relaxed text-zinc-800",
            segment.isStreaming && "shimmer-text",
          )}
        >
          {segment.content || "…"}
        </span>
      }
    />
  );
}
