"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentShimmerText } from "./agent-trace";

/**
 * Thinking card — header is always "Thought for {Ns}" (or "Thinking…" while
 * live). Body is a white rounded card with auto-scrolling reasoning.
 * Collapsed by default once complete; expands while streaming.
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
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    resolveDurationSeconds(segment),
  );
  const [expanded, setExpanded] = useState(streaming);

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

  const headerLabel = streaming
    ? `Thinking… ${elapsedSeconds}s`
    : `Thought for ${elapsedSeconds}s`;

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
        className="no-hover no-hover-overlay flex w-full max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]",
            streaming ? "text-zinc-500" : "text-zinc-400",
          )}
        >
          {streaming ? (
            <AgentShimmerText>{headerLabel}</AgentShimmerText>
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
