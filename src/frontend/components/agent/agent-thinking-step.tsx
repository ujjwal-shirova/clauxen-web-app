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
        <span
          className={cn(
            "truncate font-medium",
            segment.isStreaming && "shimmer-text",
          )}
        >
          {label}
        </span>
      }
    >
      <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-[14px] leading-[1.55] text-zinc-700">
        <div
          ref={scrollRef}
          className="thinking-markdown max-h-[18rem] overflow-y-auto pr-1"
        >
          <MarkdownRenderer
            content={segment.content}
            isStreaming={segment.isStreaming}
            showCursor={false}
            lightweightStream={segment.isStreaming}
          />
        </div>
      </div>
    </AgentTimelineStep>
  );
}
