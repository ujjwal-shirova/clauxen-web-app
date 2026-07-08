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
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { AgentTimeline, AgentTimelineDone } from "./agent-timeline";
import { AgentThinkingStep } from "./agent-thinking-step";
import { AgentNarrativeStep } from "@/frontend/components/agent/agent-narrative-step";
import { AgentToolBlock } from "./agent-tool-blocks";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function isTextSegment(segment: AgentSegment): segment is AgentTextSegment {
  return segment.kind === "text";
}

function workSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "tool" ||
      segment.kind === "text",
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
  const [expanded, setExpanded] = useState(true);
  const userToggledRef = useRef(false);
  const items = workSegments(segments);
  const hasUserInputTool = items.some(
    (segment) =>
      segment.kind === "tool" && segment.name === "ask_user_input_v0",
  );
  const userInputTools = items.filter(
    (segment): segment is AgentToolSegment =>
      isToolSegment(segment) && segment.name === "ask_user_input_v0",
  );
  const timelineItems = items.filter(
    (segment) =>
      !(
        isToolSegment(segment) && segment.name === "ask_user_input_v0"
      ),
  );
  const userInputOnly = hasUserInputTool && timelineItems.length === 0;

  useEffect(() => {
    if (hasUserInputTool) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (isStreaming) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (frameComplete && !userToggledRef.current) {
      setExpanded(false);
    }
  }, [isStreaming, frameComplete, hasUserInputTool]);

  const hasActiveWork = items.some(
    (segment) =>
      ((segment.kind === "thinking" || segment.kind === "text") &&
        segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );

  const frameLabel = resolveFrameHeaderLabel({
    segments: items,
    hasActiveWork,
  });
  const showShimmer = shouldShimmerFrameHeader(frameLabel);
  const showCollapsedHeader = frameComplete && !expanded && !isStreaming && !hasUserInputTool;

  if (items.length === 0) {
    return null;
  }

  if (userInputOnly) {
    return (
      <div className="mb-4 w-full min-w-0">
        {userInputTools.map((segment) => (
          <AgentToolBlock key={segment.id} tool={segment} />
        ))}
      </div>
    );
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
        className="no-hover no-hover-overlay mb-2 inline-flex max-w-full items-center border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
      >
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[14px] font-medium leading-5 transition-[font-weight,color] duration-150 hover:font-semibold",
              showCollapsedHeader
                ? "text-zinc-400 hover:text-zinc-500"
                : showShimmer
                  ? "shimmer-text text-zinc-700 hover:font-semibold"
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
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!expanded}
      >
        <div
          className={cn(
            "overflow-hidden transition-opacity duration-200",
            expanded ? "opacity-100 delay-100" : "opacity-0",
          )}
        >
          {userInputTools.map((segment) => (
            <AgentToolBlock key={segment.id} tool={segment} />
          ))}
          {timelineItems.length > 0 ? (
            <AgentTimeline>
              {timelineItems.map((segment) => {
                if (isThinkingSegment(segment)) {
                  return (
                    <AgentThinkingStep key={segment.id} segment={segment} />
                  );
                }
                if (isTextSegment(segment)) {
                  return (
                    <AgentNarrativeStep key={segment.id} segment={segment} />
                  );
                }
                if (isToolSegment(segment)) {
                  return <AgentToolBlock key={segment.id} tool={segment} />;
                }
                return null;
              })}
              {frameComplete && !hasUserInputTool ? <AgentTimelineDone /> : null}
            </AgentTimeline>
          ) : null}
        </div>
      </div>
    </div>
  );
}
