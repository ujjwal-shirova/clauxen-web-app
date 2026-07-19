"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { normalizeAgentHeading } from "@/lib/agent-transcript-markup";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

function fallbackThinkingHeading(content: string): string {
  const line = content
    .split(/\n+/)
    .map((part) => part.replace(/^[#>*\-\s]+/, "").trim())
    .find((part) => part.length > 0);
  return normalizeAgentHeading(line ?? "") || "Reasoning";
}

/**
 * Live reasoning viewport. The model-authored heading shimmers independently
 * from the reasoning body, which auto-follows new thinking tokens. When the
 * phase completes, the body collapses smoothly leaving the heading + elapsed
 * duration as a quiet one-line summary (no "Thought for" prefix — the heading
 * itself is the label).
 */
export function AgentThinkingPhase({
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

  // Auto-scroll the reasoning body while streaming. Pause if the user scrolls
  // up inside the viewport so they can read prior lines without being yanked
  // back to the bottom.
  const userScrolledRef = useRef(false);
  useEffect(() => {
    if (!streaming || !scrollRef.current) return;
    if (userScrolledRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segment.content, streaming]);

  const onUserScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    userScrolledRef.current = !atBottom;
    if (atBottom) userScrolledRef.current = false;
  };

  // Reset user-scroll lock when a new streaming phase starts.
  useEffect(() => {
    if (streaming) userScrolledRef.current = false;
  }, [streaming, segment.id]);

  if (!hasBody && !streaming) return null;

  const durationLabel = streaming
    ? `${elapsedSeconds}s`
    : `${segment.durationSeconds ?? elapsedSeconds}s`;

  return (
    <AgentTraceBlock
      variant="thinking"
      isActive={streaming}
      defaultExpanded={streaming}
      title={
        <AgentShimmerText className={cn(streaming && "block max-w-full truncate")}>
          {heading}
        </AgentShimmerText>
      }
      trailing={
        <span className="tabular-nums">
          {durationLabel}
        </span>
      }
    >
      <div
        ref={scrollRef}
        onScroll={onUserScroll}
        className={cn(
          "agent-trace__thinking-viewport app-scrollbar relative max-h-[11rem] overflow-y-auto rounded-xl border border-zinc-200/70 bg-zinc-50/55 px-3 py-2.5 font-sans text-[12.5px] leading-[1.55] text-zinc-600 [&_.markdown-content]:!font-sans [&_.markdown-content_*]:!font-sans",
          streaming && "shadow-[inset_0_-16px_18px_-20px_rgba(24,24,27,0.3)]",
        )}
        aria-live={streaming ? "polite" : undefined}
        data-agent-thinking-viewport="true"
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
    </AgentTraceBlock>
  );
}
