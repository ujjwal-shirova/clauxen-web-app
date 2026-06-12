"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type {
  AgentSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { AgentTimeline, AgentTimelineDone } from "./agent-timeline";
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
  frameComplete,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  frameComplete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = workSegments(segments);

  const hasActiveWork = items.some(
    (segment) =>
      (segment.kind === "thinking" && segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );

  const lastCompletedSearchQuery = useMemo(() => {
    const tools = items.filter(isToolSegment);
    for (let index = tools.length - 1; index >= 0; index -= 1) {
      const tool = tools[index];
      if (
        (tool.name === "web_search" || tool.name === "web_fetch") &&
        tool.status !== "running"
      ) {
        return (
          tool.searchQuery ??
          (typeof tool.args?.query === "string" ? tool.args.query : undefined)
        );
      }
    }
    return undefined;
  }, [items]);

  const frameLabel = hasActiveWork
    ? "Working"
    : lastCompletedSearchQuery
      ? `"${lastCompletedSearchQuery}"`
      : "Working";

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
        <span
          className={cn(
            "truncate text-[14px] font-medium leading-5 text-zinc-700",
            hasActiveWork && "shimmer-text",
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
          {frameComplete ? <AgentTimelineDone label="Done" /> : null}
        </AgentTimeline>
      ) : null}
    </div>
  );
}
