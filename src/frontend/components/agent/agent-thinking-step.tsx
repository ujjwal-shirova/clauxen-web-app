"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { AgentThinkingSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentTimelineStep } from "./agent-timeline";

function thinkingTitle(segment: AgentThinkingSegment): string {
  if (segment.isStreaming) return "Thinking";
  const durationSeconds =
    segment.durationSeconds ??
    (segment.startedAtMs
      ? Math.max(1, Math.round((Date.now() - segment.startedAtMs) / 1000))
      : 1);
  return `Thought for ${durationSeconds}s`;
}

export function AgentThinkingStep({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = thinkingTitle(segment);

  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

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
            {label}
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
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}
