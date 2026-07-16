"use client";

import { useEffect, useRef, useState } from "react";
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

export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(() => thinkingTitle(segment));
  const [detailsOpen, setDetailsOpen] = useState(() => !!segment.isStreaming);

  useEffect(() => {
    if (!segment.isStreaming) {
      setLabel(thinkingTitle(segment));
      setDetailsOpen(false);
      return;
    }

    setDetailsOpen(true);
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

  useEffect(() => {
    if (!segment.isStreaming || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segment.content, segment.isStreaming]);

  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  return (
    <AgentTimelineStep
      icon="thinking"
      isActive={!!segment.isStreaming}
      title={
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          className={cn(
            "no-hover no-hover-overlay inline-flex max-w-full items-center border-0 bg-transparent p-0 text-left shadow-none",
            segment.isStreaming ? "shimmer-text text-zinc-700" : "text-zinc-500",
          )}
          aria-expanded={detailsOpen}
        >
          <span className="truncate font-medium">{label}</span>
        </button>
      }
    >
      {detailsOpen && segment.content.trim() ? (
        <div className="rounded-[12px] border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5 text-[13px] leading-[1.55] text-zinc-600">
          <div
            ref={scrollRef}
            className="thinking-markdown max-h-[14rem] overflow-y-auto pr-1"
          >
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
