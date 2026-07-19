"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { normalizeAgentHeading } from "@/lib/agent-transcript-markup";
import { AgentShimmerText } from "./agent-trace";

function fallbackThinkingHeading(content: string): string {
  const line = content
    .split(/\n+/)
    .map((part) => part.replace(/^[#>*\-\s]+/, "").trim())
    .find((part) => part.length > 0);
  return normalizeAgentHeading(line ?? "") || "Working through the request";
}

/**
 * Thinking card — muted heading + duration above a white rounded body.
 * Reasoning streams into the card with auto-scroll (paused if the user
 * scrolls up). Collapses to the heading line when idle.
 *
 * No timeline rail. Matches the floating-card agent action style.
 */
export function AgentThinkingPhase({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const streaming = !!segment.isStreaming;
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const userToggledRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    segment.durationSeconds ?? 1,
  );
  const [expanded, setExpanded] = useState(streaming);

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
    if (streaming) {
      userToggledRef.current = false;
      userScrolledRef.current = false;
      setExpanded(true);
      return;
    }
    if (!userToggledRef.current) {
      setExpanded(false);
    }
  }, [streaming, segment.id]);

  useEffect(() => {
    if (!streaming || !scrollRef.current || userScrolledRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segment.content, streaming]);

  const onUserScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    userScrolledRef.current = !atBottom;
  };

  if (!hasBody && !streaming) return null;

  const durationLabel = `${elapsedSeconds}s`;

  return (
    <div
      className="agent-thinking min-w-0 animate-in fade-in duration-200"
      data-agent-segment="thinking"
      data-streaming={streaming || undefined}
    >
      <button
        type="button"
        onClick={() => {
          if (!hasBody) return;
          userToggledRef.current = true;
          setExpanded((value) => !value);
        }}
        className="no-hover no-hover-overlay flex w-full max-w-full items-baseline gap-2 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]",
            streaming ? "text-zinc-500" : "text-zinc-400",
          )}
        >
          {streaming ? (
            <AgentShimmerText>{heading}</AgentShimmerText>
          ) : (
            heading
          )}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-zinc-400">
          {durationLabel}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]",
          expanded && hasBody ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!expanded}
      >
        <div
          className={cn(
            "overflow-hidden transition-opacity duration-200",
            expanded && hasBody ? "opacity-100" : "opacity-0",
          )}
        >
          <div
            ref={scrollRef}
            onScroll={onUserScroll}
            className={cn(
              "agent-thinking__card app-scrollbar mt-2 max-h-[14rem] overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white px-4 py-3.5 text-[13.5px] font-[430] leading-[1.55] tracking-[-0.01em] text-zinc-700 [&_.markdown-content]:!font-sans [&_.markdown-content_*]:!font-sans",
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
        </div>
      </div>
    </div>
  );
}
