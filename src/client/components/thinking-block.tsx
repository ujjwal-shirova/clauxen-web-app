"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";

interface ThinkingBlockProps {
  className?: string;
  label?: string;
  content?: string;
  isStreaming?: boolean;
  thinkingDurationSeconds?: number;
  thinkingStartedAtMs?: number;
}

function resolveThinkingDurationSeconds(input: {
  isStreaming: boolean;
  thinkingDurationSeconds?: number;
  thinkingStartedAtMs?: number;
}): number {
  if (
    typeof input.thinkingDurationSeconds === "number" &&
    input.thinkingDurationSeconds > 0
  ) {
    return input.thinkingDurationSeconds;
  }
  if (typeof input.thinkingStartedAtMs === "number") {
    return Math.max(
      1,
      Math.round((Date.now() - input.thinkingStartedAtMs) / 1000),
    );
  }
  return 1;
}

export function ThinkingBlock({
  className,
  label = "Thinking",
  content = "",
  isStreaming = false,
  thinkingDurationSeconds,
  thinkingStartedAtMs,
}: ThinkingBlockProps) {
  const [isVisible, setIsVisible] = useState(isStreaming);
  const [elapsedSeconds, setElapsedSeconds] = useState(1);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousIsStreamingRef = useRef(isStreaming);

  // Latch the earliest thinking start so a late-arriving stamp can never push
  // the live "Thinking for Ns" clock forward mid-stream.
  const latchedThinkingStartRef = useRef<number | undefined>(
    thinkingStartedAtMs,
  );
  if (
    thinkingStartedAtMs !== undefined &&
    (latchedThinkingStartRef.current === undefined ||
      thinkingStartedAtMs < latchedThinkingStartRef.current)
  ) {
    latchedThinkingStartRef.current = thinkingStartedAtMs;
  }
  const latchedThinkingStart = latchedThinkingStartRef.current;

  useEffect(() => {
    if (!isVisible) return;
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [content, isVisible]);

  useEffect(() => {
    const wasStreaming = previousIsStreamingRef.current;
    previousIsStreamingRef.current = isStreaming;

    if (!wasStreaming && isStreaming) {
      setIsVisible(true);
      return;
    }

    if (wasStreaming && !isStreaming) {
      setIsVisible(false);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      setElapsedSeconds(
        resolveThinkingDurationSeconds({
          isStreaming: false,
          thinkingDurationSeconds,
          thinkingStartedAtMs: latchedThinkingStart,
        }),
      );
      return;
    }

    const tick = () => {
      setElapsedSeconds(
        resolveThinkingDurationSeconds({
          isStreaming: true,
          thinkingDurationSeconds,
          thinkingStartedAtMs: latchedThinkingStart,
        }),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, thinkingDurationSeconds, latchedThinkingStart]);

  const handleCopy = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const hasContent = Boolean(content.trim());
  if (!hasContent && !isStreaming && !thinkingDurationSeconds) {
    return null;
  }

  const displayLabel = isStreaming
    ? `${label} for ${elapsedSeconds}s`
    : `Thought for ${elapsedSeconds}s`;

  return (
    <div
      className={cn(
        "w-full animate-in fade-in slide-in-from-top-1 duration-200",
        className,
      )}
    >
      <div className="grid gap-y-1.5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setIsVisible((value) => !value)}
            className={cn(
              "group/thinking inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-left text-[12.5px] font-medium leading-none transition-all duration-150",
              "border-zinc-200/90 bg-white/80 text-zinc-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm",
              "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
              "dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-zinc-100",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
              isVisible &&
                "border-zinc-300 bg-zinc-100/90 text-zinc-900 dark:border-white/20 dark:bg-white/10 dark:text-zinc-100",
            )}
            aria-expanded={isVisible}
            aria-label={`${displayLabel} — click to ${isVisible ? "collapse" : "expand"}`}
          >
            <Brain
              className={cn(
                "size-3.5 shrink-0 transition-colors",
                isStreaming
                  ? "animate-pulse text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-400 group-hover/thinking:text-zinc-600 dark:text-zinc-500 dark:group-hover/thinking:text-zinc-300",
              )}
            />
            <span
              className={cn(
                "truncate font-medium",
                isStreaming && "shimmer-text",
              )}
              data-shimmer-active={isStreaming || undefined}
            >
              {displayLabel}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-zinc-400 transition-transform duration-200 group-hover/thinking:text-zinc-600 dark:text-zinc-500 dark:group-hover/thinking:text-zinc-300",
                isVisible && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Animated height container */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            isVisible
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none",
          )}
          aria-hidden={!isVisible}
        >
          <div className="overflow-hidden">
            <div className="mt-1 w-full max-w-[48rem] overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/70 shadow-[0_1px_3px_rgba(24,24,27,0.02)] backdrop-blur-sm dark:border-white/10 dark:bg-[#1a1a1e]/80">
              <div className="flex items-center justify-between border-b border-zinc-200/70 px-3 py-1.5 dark:border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-400 dark:text-zinc-500">
                  <Brain className="size-3 text-zinc-400 dark:text-zinc-500" />
                  <span>Thought process</span>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="tabular-nums normal-case text-zinc-500 dark:text-zinc-400">
                    {elapsedSeconds}s {isStreaming ? "elapsed" : "duration"}
                  </span>
                </div>
                {hasContent ? (
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? "Copied thinking" : "Copy thinking"}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                  >
                    {copied ? (
                      <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                ) : null}
              </div>

              <div
                ref={scrollRef}
                className="agent-thinking-scroll max-h-[20rem] overflow-x-hidden overflow-y-auto px-3.5 py-3 text-[13px] leading-[1.65] text-zinc-600 dark:text-zinc-300"
                data-chat-scroll-passthrough=""
              >
                <div className="thinking-markdown">
                  {hasContent ? (
                    <MarkdownRenderer
                      content={content}
                      isStreaming={isStreaming}
                      showCursor={false}
                      lightweightStream={isStreaming}
                    />
                  ) : (
                    <p className="text-[12.5px] italic text-zinc-400 dark:text-zinc-500">
                      {isStreaming
                        ? "Extended reasoning is in progress…"
                        : "Extended reasoning completed before this response."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
