"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  resolveFrameHeaderLabel,
  shouldShimmerFrameHeader,
} from "@/frontend/lib/agent-frame-label";
import type {
  AgentSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { AgentTimeline } from "./agent-timeline";
import { AgentThinkingStep } from "./agent-thinking-step";
import { AgentToolBlock } from "./agent-tool-blocks";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function workSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) => segment.kind === "thinking" || segment.kind === "tool",
  );
}

export function AgentWorkFrame({
  segments,
  isStreaming,
  leadingContent,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  leadingContent?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = workSegments(segments);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    }
  }, [isStreaming]);

  const hasActiveWork = items.some(
    (segment) =>
      (segment.kind === "thinking" && segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );

  const frameLabel = resolveFrameHeaderLabel({
    segments: items,
    hasActiveWork,
  });
  const showShimmer = shouldShimmerFrameHeader(frameLabel);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 w-full min-w-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mb-2 flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        {leadingContent ? (
          <span className="flex shrink-0 items-center">{leadingContent}</span>
        ) : null}
        <span
          className={cn(
            "truncate text-[14px] font-medium leading-5 text-zinc-700",
            showShimmer && "shimmer-text",
          )}
        >
          {frameLabel}
        </span>
        <ChevronDown
          className={cn(
            "icon-md shrink-0 text-zinc-400 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <AgentTimeline>
          {items.map((segment) => {
            if (isThinkingSegment(segment)) {
              return <AgentThinkingStep key={segment.id} segment={segment} />;
            }
            if (isToolSegment(segment)) {
              return <AgentToolBlock key={segment.id} tool={segment} />;
            }
            return null;
          })}
        </AgentTimeline>
      ) : null}
    </div>
  );
}
