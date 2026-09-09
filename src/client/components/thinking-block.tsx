"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousIsStreamingRef = useRef(isStreaming);

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
          thinkingStartedAtMs,
        }),
      );
      return;
    }

    const tick = () => {
      setElapsedSeconds(
        resolveThinkingDurationSeconds({
          isStreaming: true,
          thinkingDurationSeconds,
          thinkingStartedAtMs,
        }),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, thinkingDurationSeconds, thinkingStartedAtMs]);

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
        "w-full animate-in fade-in slide-in-from-top-1 duration-300",
        className,
      )}
    >
      <div>
        <div className="grid gap-y-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setIsVisible((value) => !value)}
              className="group flex w-fit max-w-full items-center gap-1.5 border-0 bg-transparent py-0.5 text-left text-[14px] font-normal leading-6 text-[var(--ui-fg-muted)] transition-colors duration-200 hover:bg-transparent hover:text-[var(--ui-fg)] focus-visible:outline-none"
              aria-expanded={isVisible}
            >
              <span
                className={cn(
                  "agent-activity-label--muted truncate font-normal",
                  isStreaming && "shimmer-text",
                )}
                data-shimmer-active={isStreaming || undefined}
              >
                {displayLabel}
              </span>
              <ChevronDown
                className={cn(
                  "icon-md shrink-0 icon-muted opacity-0 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
                  isVisible && "rotate-180",
                )}
              />
            </button>
          </div>

          {/* Grid-rows trick animates the collapse/expand instead of hard-unmounting
              the content (which used to cut instantly with no transition). */}
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              isVisible ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
            aria-hidden={!isVisible}
          >
            <div className="overflow-hidden pt-0.5">
              <div className="agent-thinking-body grid max-w-[48rem] gap-3 pr-3 text-[14px] font-normal leading-6 text-[var(--ui-fg-muted)]">
                <div
                  ref={scrollRef}
                  className="pr-1 text-[14px] leading-6"
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
                      <p className="text-[var(--ui-fg-placeholder)]">
                        {isStreaming
                          ? "Extended reasoning is in progress."
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
    </div>
  );
}
