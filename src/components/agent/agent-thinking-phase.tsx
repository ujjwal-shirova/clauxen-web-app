"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentThinkingSegment } from "@/lib/agent-segments";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AgentShimmerText } from "./agent-trace";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";

/**
 * Thinking card — expanded while streaming, auto-collapses when the phase
 * finishes (unless the user toggled it). Header is always Thought for / Thinking….
 */
export function AgentThinkingPhase({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const streaming = !!segment.isStreaming;
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement | null>(null);
  const userScrolledRef = useRef(false);
  const userToggledRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    resolveDurationSeconds(segment),
  );
  const [expanded, setExpanded] = useState(() => streaming);

  const hasBody = segment.content.trim().length > 0;

  useEffect(() => {
    if (!streaming) {
      setElapsedSeconds(resolveDurationSeconds(segment));
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
  }, [streaming, segment.durationSeconds, segment.startedAtMs, segment]);

  useEffect(() => {
    if (userToggledRef.current) return;
    if (streaming) {
      userScrolledRef.current = false;
      setExpanded(true);
      return;
    }
    setExpanded(false);
  }, [streaming, segment.id]);

  useEffect(() => {
    if (!streaming || !expanded || !scrollRef.current || userScrolledRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segment.content, streaming, expanded]);

  const onUserScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    userScrolledRef.current = !atBottom;
  };

  if (!hasBody && !streaming) return null;

  const headerLabel = streaming
    ? `Thinking… ${elapsedSeconds}s`
    : `Thought for ${elapsedSeconds}s`;

  return (
    <div
      className="agent-thinking min-w-0"
      data-agent-segment="thinking"
      data-streaming={streaming || undefined}
    >
      <button
        ref={headerRef}
        type="button"
        onClick={() => {
          if (!hasBody) return;
          userToggledRef.current = true;
          preserveScrollAnchorOnToggle(headerRef.current, () => {
            setExpanded((value) => !value);
          });
        }}
        className="no-hover no-hover-overlay flex w-full max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
      >
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
          <span
            className={cn(
              "min-w-0 truncate text-left text-[13px] font-[430] leading-5 tracking-[-0.01em]",
              streaming ? "text-zinc-500" : "text-zinc-400",
            )}
          >
            {streaming ? (
              <AgentShimmerText key={`thinking-${segment.id}`} active>
                {headerLabel}
              </AgentShimmerText>
            ) : (
              headerLabel
            )}
          </span>
          {hasBody ? (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
          ) : null}
        </span>
      </button>

      {/* Instant open/close — height transitions fight stream-follow scroll. */}
      {expanded && hasBody ? (
        <div
          ref={scrollRef}
          onScroll={onUserScroll}
          className={cn(
            "agent-thinking__card app-scrollbar mt-2 max-h-[14rem] overflow-y-auto overscroll-y-contain rounded-2xl border border-zinc-200/80 bg-white px-4 py-3.5 text-[13.5px] font-[430] leading-[1.55] tracking-[-0.01em] text-zinc-700 [&_.markdown-content]:!font-sans [&_.markdown-content_*]:!font-sans",
            streaming &&
              "shadow-[inset_0_-18px_20px_-22px_rgba(24,24,27,0.22)]",
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
      ) : null}
    </div>
  );
}

function resolveDurationSeconds(segment: AgentThinkingSegment): number {
  if (
    typeof segment.durationSeconds === "number" &&
    segment.durationSeconds > 0
  ) {
    return segment.durationSeconds;
  }
  if (typeof segment.startedAtMs === "number" && segment.startedAtMs > 0) {
    return Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000));
  }
  return 1;
}
