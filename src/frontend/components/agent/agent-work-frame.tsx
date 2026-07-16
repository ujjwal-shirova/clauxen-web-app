"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  formatWorkedDuration,
  resolveActiveStepLabel,
  resolveWorkedForLabel,
  shouldShimmerFrameHeader,
  WORKING_LABEL,
} from "@/frontend/lib/agent-frame-label";
import type {
  AgentSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import { AgentActivityList } from "./agent-timeline";
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

function thinkingOnlyDurationSeconds(segments: AgentSegment[]): number | null {
  const items = workSegments(segments);
  const thinking = items.filter(isThinkingSegment);
  const tools = items.filter(isToolSegment);
  if (thinking.length === 0 || tools.length > 0) return null;
  const last = thinking[thinking.length - 1]!;
  if (last.durationSeconds && last.durationSeconds > 0) {
    return last.durationSeconds;
  }
  if (last.startedAtMs) {
    return Math.max(1, Math.round((Date.now() - last.startedAtMs) / 1000));
  }
  return 1;
}

/**
 * Agentic activity panel for one assistant work turn (ChatGPT / Claude / Cursor).
 *
 * Live: compact action list (thinking optional, tools as actions) with a
 * shimmering step label and live elapsed time.
 * Done: collapses to "Thought for …" (thinking-only) or "Worked for …"
 * (tools) with the chevron beside the label.
 */
export function AgentWorkFrame({
  segments,
  isStreaming,
  frameComplete,
  startedAtMs,
  completedAtMs,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  frameComplete: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
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
  const activityItems = items.filter(
    (segment) =>
      !(isToolSegment(segment) && segment.name === "ask_user_input_v0"),
  );
  const userInputOnly = hasUserInputTool && activityItems.length === 0;
  const turnFinished = frameComplete && !isStreaming;

  useEffect(() => {
    if (hasUserInputTool && !turnFinished) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (isStreaming) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (turnFinished && !userToggledRef.current) {
      setExpanded(false);
    }
  }, [isStreaming, turnFinished, hasUserInputTool]);

  // Live elapsed ticker while the frame is open (ChatGPT/Claude feel).
  useEffect(() => {
    if (!isStreaming || turnFinished || !startedAtMs) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, turnFinished, startedAtMs]);

  const hasActiveWork = items.some(
    (segment) =>
      ((segment.kind === "thinking" || segment.kind === "text") &&
        segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );

  const resolvedCompletedAtMs =
    typeof completedAtMs === "number" &&
    typeof startedAtMs === "number" &&
    completedAtMs >= startedAtMs
      ? completedAtMs
      : turnFinished && typeof startedAtMs === "number"
        ? nowMs
        : undefined;

  const workedForLabel = resolveWorkedForLabel({
    startedAtMs,
    completedAtMs: resolvedCompletedAtMs,
  });

  const thoughtOnlySeconds = turnFinished
    ? thinkingOnlyDurationSeconds(items)
    : null;

  const liveLabel =
    resolveActiveStepLabel(items) ??
    (hasActiveWork ? WORKING_LABEL : "Working");

  const liveElapsed =
    isStreaming && typeof startedAtMs === "number"
      ? formatWorkedDuration(Math.max(1000, nowMs - startedAtMs))
      : null;

  const frameLabel = turnFinished
    ? thoughtOnlySeconds != null
      ? `Thought for ${thoughtOnlySeconds}s`
      : (workedForLabel ?? "Worked")
    : liveElapsed
      ? `${liveLabel} · ${liveElapsed}`
      : liveLabel;

  const showShimmer =
    isStreaming &&
    (hasActiveWork || shouldShimmerFrameHeader(liveLabel));

  if (items.length === 0) return null;

  if (userInputOnly) {
    return (
      <div className="mb-3 w-full min-w-0">
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
    <div
      className="mb-3 w-full min-w-0"
      data-agent-work-frame="true"
      data-agent-activity="panel"
      data-agent-frame-complete={turnFinished || undefined}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="no-hover no-hover-overlay mb-1.5 inline-flex max-w-full items-center gap-1 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
        aria-label={
          expanded ? `Collapse: ${frameLabel}` : `Expand: ${frameLabel}`
        }
      >
        <span
          className={cn(
            "truncate text-[13.5px] font-medium leading-5",
            turnFinished && !expanded
              ? "text-zinc-400 hover:text-zinc-500"
              : showShimmer
                ? "shimmer-text"
                : "text-zinc-600",
          )}
        >
          {frameLabel}
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      </button>

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
            expanded ? "opacity-100" : "opacity-0",
          )}
        >
          {userInputTools.map((segment) => (
            <AgentToolBlock key={segment.id} tool={segment} />
          ))}
          {activityItems.length > 0 ? (
            <AgentActivityList>
              {activityItems.map((segment) => {
                if (isThinkingSegment(segment)) {
                  // Skip empty non-streaming thinking — not a required block.
                  if (!segment.content.trim() && !segment.isStreaming) {
                    return null;
                  }
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
            </AgentActivityList>
          ) : null}
        </div>
      </div>
    </div>
  );
}
