"use client";

import { useMemo } from "react";
import type {
  AgentNarrationSegment,
  AgentSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { AgentActivityList } from "./agent-timeline";
import { AgentThinkingStep } from "./agent-thinking-step";
import { AgentNarrativeStep } from "./agent-narrative-step";
import { AgentToolBlock } from "./agent-tool-blocks";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function isNarrationSegment(
  segment: AgentSegment,
): segment is AgentNarrationSegment | AgentTextSegment {
  return segment.kind === "narration" || segment.kind === "text";
}

function transcriptSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "narration" ||
      segment.kind === "text" ||
      segment.kind === "tool",
  );
}

/**
 * One ordered trace for the whole assistant turn. The event kind owns its
 * presentation: reasoning auto-scrolls, narration reads like a quiet update,
 * and tools render their native result surface.
 */
export function AgentWorkFrame({
  segments,
  isStreaming,
  frameComplete,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  frameComplete: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
}) {
  const items = useMemo(() => transcriptSegments(segments), [segments]);

  if (items.length === 0) return null;

  return (
    <div
      className="mb-3 w-full min-w-0"
      data-agent-work-frame="true"
      data-agent-transcript="true"
      data-agent-frame-complete={frameComplete && !isStreaming ? "true" : undefined}
    >
      <AgentActivityList>
        {items.map((segment) => {
          if (isThinkingSegment(segment)) {
            return <AgentThinkingStep key={segment.id} segment={segment} />;
          }

          if (isNarrationSegment(segment)) {
            return <AgentNarrativeStep key={segment.id} segment={segment} />;
          }

          if (isToolSegment(segment)) {
            return (
              <div
                key={segment.id}
                className="min-w-0"
                data-agent-tool-group={segment.name}
              >
                <AgentToolBlock tool={segment} />
              </div>
            );
          }

          return null;
        })}
      </AgentActivityList>
    </div>
  );
}
