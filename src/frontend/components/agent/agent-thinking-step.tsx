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
 * Clauxen Code pattern: thinking is collapsed by default (∴ Thinking / Thought for Ns);
 * expand via chevron to read the monologue. Auto-opens while streaming.
 */
export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [label, setLabel] = useState(() => thinkingTitle(segment));

  useEffect(() => {
    if (!segment.isStreaming) {
      setLabel(thinkingTitle(segment));
      return;
    }
    const tick = () => setLabel(thinkingTitle(segment));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    segment.isStreaming,
    segment.durationSeconds,
    segment.startedAtMs,
    segment.content,
  ]);

  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  return (
    <AgentTimelineStep
      icon="thinking"
      isActive={!!segment.isStreaming}
      collapsible
      title={
        <span
          className={cn(
            "truncate font-medium",
            segment.isStreaming ? "shimmer-text text-zinc-700" : "text-zinc-500",
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
              isStreaming={segment.isStreaming}
              showCursor={false}
              lightweightStream={segment.isStreaming}
            />
          </div>
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}
