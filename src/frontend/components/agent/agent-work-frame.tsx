"use client";

import { useEffect, useRef, useState } from "react";
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
  liveNarrative,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  frameComplete: boolean;
  /** Short natural language progress emitted by the model for this phase (e.g. "searching web...", "got results, checking further"). */
  liveNarrative?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const userToggledRef = useRef(false);
  const items = workSegments(segments);

  useEffect(() => {
    if (isStreaming) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (frameComplete && !userToggledRef.current) {
      setExpanded(false);
    }
  }, [isStreaming, frameComplete]);

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
  const showCollapsedHeader = frameComplete && !expanded && !isStreaming;

  if (items.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    userToggledRef.current = true;
    setExpanded((value) => !value);
  };

  return (
    <div className="mb-4 w-full min-w-0">
      <button
        type="button"
        onClick={toggleExpanded}
        className="mb-2 flex w-full max-w-full items-center text-left"
        aria-expanded={expanded}
      >
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[14px] font-medium leading-5",
              showCollapsedHeader
                ? "text-zinc-400"
                : showShimmer
                  ? "shimmer-text text-zinc-700"
                  : "text-zinc-700",
            )}
          >
            {frameLabel}
          </span>
          <ChevronDown
            className={cn(
              "icon-md shrink-0 text-zinc-400 transition-transform duration-200",
              expanded ? "rotate-180" : "-rotate-90",
            )}
            aria-hidden
          />
        </span>
      </button>

      {/* Smooth auto-collapse with transition.
          Uses grid-rows trick for height animation without JS measurement.
          Works for the vertical timeline of thinking + multiple tool executions. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
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
            {frameComplete ? <AgentTimelineDone /> : null}

            {/* Live model-generated delta / progress narrative (Cursor-style text-delta driven).
                Rendered as a soft card above the timeline to match the autonomous agent "spoken thoughts"
                style shown in the reference screenshot. */}
            {isStreaming && !frameComplete && liveNarrative?.trim() ? (
              <div className="mt-2 rounded-2xl border border-zinc-200/70 bg-[#f8f7f4] px-4 py-3 text-[13.5px] leading-relaxed text-zinc-700 shadow-sm">
                {liveNarrative.trim()}
              </div>
            ) : null}
          </AgentTimeline>
        </div>
      </div>
    </div>
  );
}
