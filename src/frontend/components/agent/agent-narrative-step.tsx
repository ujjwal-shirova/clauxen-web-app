"use client";

import { cn } from "@/frontend/lib/utils";
import type { AgentTextSegment } from "@/frontend/lib/agent-segments";
import { AgentTimelineStep } from "./agent-timeline";

/**
 * A short narrative note the model emits between tool calls (e.g. "I'll start
 * by researching Nvidia and then compile the findings..."). Rendered as a
 * plain clock-icon row in the vertical timeline — same family as thinking
 * steps, but no bordered content box, matching the reference agent UI.
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
            "leading-relaxed text-zinc-700",
            segment.isStreaming && "shimmer-text",
          )}
        >
          {segment.content || "…"}
        </span>
      }
    />
  );
}
