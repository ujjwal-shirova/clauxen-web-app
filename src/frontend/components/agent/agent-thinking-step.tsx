"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentActivityRow } from "./agent-timeline";

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
 * Optional thinking action — only renders when there is content or live stream.
 * Auto-scrolls the monologue while streaming.
 */
export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [label, setLabel] = useState(() => thinkingTitle(segment));
  const streaming = !!segment.isStreaming;
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [segment.content, streaming]);

  if (!segment.content.trim() && !streaming) {
    return null;
  }

  return (
    <AgentActivityRow
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
        <div className="rounded-lg bg-zinc-50/90 px-3 py-2 text-[13px] leading-[1.55] text-zinc-600 ring-1 ring-zinc-200/70">
          <div
            ref={scrollRef}
            className="thinking-markdown max-h-[12rem] overflow-y-auto pr-1"
          >
            <MarkdownRenderer
              content={segment.content}
              isStreaming={streaming}
              showCursor={false}
              lightweightStream={streaming}
            />
          </div>
        </div>
      ) : streaming ? (
        <div className="h-1" aria-hidden />
      ) : null}
    </AgentActivityRow>
  );
}
