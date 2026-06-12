"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentTimelineStep } from "./agent-timeline";

export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = useMemo(
    () =>
      segment.content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [segment.content],
  );

  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  const summary =
    segment.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, 120) ??
    (segment.isStreaming ? "Thinking" : "Thought");

  const label = segment.isStreaming
    ? "Thinking"
    : `Thought for ${segment.durationSeconds ?? 0}s`;

  return (
    <AgentTimelineStep
      icon="thinking"
      isActive={!!segment.isStreaming}
      title={
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center gap-2 text-left"
        >
          <span
            className={cn(
              "truncate font-medium",
              segment.isStreaming && "shimmer-text",
            )}
          >
            {segment.isStreaming ? label : summary}
          </span>
          <ChevronDown
            className={cn(
              "icon-md shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      }
    >
      {expanded ? (
        <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-[14px] leading-[1.55] text-zinc-700">
          <div className="thinking-markdown max-h-[18rem] overflow-y-auto pr-1">
            <MarkdownRenderer
              content={segment.content}
              isStreaming={segment.isStreaming}
              showCursor={false}
              lightweightStream={segment.isStreaming}
            />
          </div>
          {!segment.isStreaming && lineCount > 4 ? (
            <div className="mt-2 text-[12px] text-zinc-400">{label}</div>
          ) : null}
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}
