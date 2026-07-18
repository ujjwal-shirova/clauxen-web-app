"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { normalizeAgentHeading } from "@/lib/agent-transcript-markup";
import { AgentTimelineStep } from "./agent-timeline";

function fallbackThinkingHeading(content: string): string {
  const line = content
    .split(/\n+/)
    .map((part) => part.replace(/^[#>*\-\s]+/, "").trim())
    .find((part) => part.length > 0);
  return normalizeAgentHeading(line ?? "") || "Reasoning through the task";
}

/**
 * Live reasoning viewport. The model-authored heading shimmers independently
 * from the reasoning body, which auto-follows new thinking tokens.
 */
export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const streaming = !!segment.isStreaming;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    segment.durationSeconds ?? 1,
  );
  const heading =
    normalizeAgentHeading(segment.heading ?? "") ||
    fallbackThinkingHeading(segment.content);
  const hasBody = segment.content.trim().length > 0;

  useEffect(() => {
    if (!streaming) {
      setElapsedSeconds(segment.durationSeconds ?? 1);
      return;
    }

    const tick = () => {
      setElapsedSeconds(
        segment.startedAtMs
          ? Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000))
          : 1,
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [streaming, segment.durationSeconds, segment.startedAtMs]);

  useEffect(() => {
    if (!streaming || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segment.content, streaming]);

  if (!hasBody && !streaming) return null;

  return (
    <div
      className="min-w-0"
      data-agent-segment="thinking"
      data-streaming={streaming || undefined}
    >
      <AgentTimelineStep
      icon="thinking"
      isActive={streaming}
      title={
        <span
          className={cn(
            "block max-w-full truncate",
            streaming && "shimmer-text",
          )}
        >
          {heading}
        </span>
      }
      trailing={
        <span className="tabular-nums">
          {streaming
            ? `${elapsedSeconds}s`
            : `${segment.durationSeconds ?? elapsedSeconds}s`}
        </span>
      }
      defaultExpanded={streaming}
    >
      <div
        ref={scrollRef}
        className={cn(
          "app-scrollbar relative max-h-[10.5rem] overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/65 px-3 py-2.5 font-sans text-[12.5px] leading-[1.55] text-zinc-600 [&_.markdown-content]:!font-sans [&_.markdown-content_*]:!font-sans",
          streaming && "shadow-[inset_0_-16px_18px_-20px_rgba(24,24,27,0.3)]",
        )}
        aria-live={streaming ? "polite" : undefined}
      >
        <div className="thinking-markdown">
          <MarkdownRenderer
            content={segment.content || "…"}
            isStreaming={streaming}
            streamKey={segment.id}
            showCursor={false}
            lightweightStream={streaming}
          />
        </div>
      </div>
      </AgentTimelineStep>
    </div>
  );
}
