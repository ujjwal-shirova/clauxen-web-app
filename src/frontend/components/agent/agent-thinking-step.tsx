"use client";

import { useEffect, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentTimelineStep } from "./agent-timeline";

function resolveThinkingDurationSeconds(segment: AgentThinkingSegment): number {
  if (segment.durationSeconds && segment.durationSeconds > 0) {
    return segment.durationSeconds;
  }
  if (segment.startedAtMs) {
    return Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000));
  }
  return 1;
}

function thinkingTitle(segment: AgentThinkingSegment): string {
  if (segment.isStreaming) return "Thinking";
  return `Thought for ${resolveThinkingDurationSeconds(segment)}s`;
}

/**
 * Streaming: shimmering "Thinking" label (same effect as tool steps / frame header).
 * Complete: collapses to "Thought for Ns"; expand for the monologue.
 */
export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [label, setLabel] = useState(() => thinkingTitle(segment));
  const streaming = !!segment.isStreaming;

  useEffect(() => {
    if (!streaming) {
      setLabel(thinkingTitle(segment));
      return;
    }
    const tick = () => setLabel(thinkingTitle(segment));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    streaming,
    segment.durationSeconds,
    segment.startedAtMs,
    segment.content,
    segment,
  ]);

  if (!segment.content.trim() && !streaming) {
    return null;
  }

  return (
    <AgentTimelineStep
      icon="thinking"
      isActive={streaming}
      collapsible
      title={
        <span
          className={cn(
            "truncate font-medium",
            streaming ? "shimmer-text" : "text-zinc-500",
          )}
        >
          {label}
        </span>
      }
    >
      {segment.content.trim() ? (
        <div className="rounded-[12px] border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5 text-[13px] leading-[1.55] text-zinc-600">
          <div className="thinking-markdown max-h-[14rem] overflow-y-auto pr-1">
            <MarkdownRenderer
              content={segment.content}
              isStreaming={streaming}
              showCursor={false}
              lightweightStream={streaming}
            />
          </div>
        </div>
      ) : streaming ? (
        // Keep a body so the step stays expandable while the first tokens arrive.
        <div className="h-1" aria-hidden />
      ) : null}
    </AgentTimelineStep>
  );
}
