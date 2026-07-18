"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";

function firstThinkingLine(content: string): string {
  const line = content
    .split(/\n+/)
    .map((part) => part.replace(/^[#>*\-\s]+/, "").trim())
    .find((part) => part.length > 0);
  return line ?? "";
}

/**
 * Interleaved thinking — Anthropic transcript style.
 * Sans-serif planning line with a clock icon (distinct from serif narration).
 */
export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const streaming = !!segment.isStreaming;
  const [expanded, setExpanded] = useState(false);
  const summary = firstThinkingLine(segment.content);
  const hasBody = segment.content.trim().length > 0;
  const multiLine = segment.content.trim().includes("\n") || segment.content.length > 140;

  useEffect(() => {
    if (streaming) setExpanded(false);
  }, [streaming]);

  if (!hasBody && !streaming) return null;

  return (
    <div
      className="min-w-0 animate-in fade-in duration-200"
      data-agent-segment="thinking"
      data-streaming={streaming || undefined}
    >
      <button
        type="button"
        onClick={() => {
          if (!multiLine || streaming) return;
          setExpanded((value) => !value);
        }}
        className={cn(
          "no-hover no-hover-overlay flex w-full max-w-full items-start gap-2 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent",
          multiLine && !streaming ? "cursor-pointer" : "cursor-default",
        )}
        aria-expanded={multiLine ? expanded : undefined}
      >
        <Clock
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400"
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 font-sans text-[13.5px] font-normal leading-5 text-zinc-500",
            streaming && "shimmer-text",
            !expanded && "line-clamp-2",
          )}
        >
          {summary || (streaming ? "…" : "")}
        </span>
      </button>

      {expanded && multiLine ? (
        <div className="mt-1.5 ml-[22px] max-h-48 overflow-y-auto rounded-lg bg-zinc-50/80 px-3 py-2 text-[13px] leading-[1.55] text-zinc-600 ring-1 ring-zinc-200/60">
          <div className="thinking-markdown">
            <MarkdownRenderer
              content={segment.content}
              isStreaming={false}
              showCursor={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
