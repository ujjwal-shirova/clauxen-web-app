"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";
import {
  buildActivitySummaryParts,
  type ActivitySummaryPart,
} from "@/lib/agent-activity-summary";
import { AgentShimmerText } from "./agent-trace";

function renderParts(parts: ActivitySummaryPart[]): ReactNode {
  return parts.map((part, index) => {
    if (part.kind === "diff") {
      return (
        <span
          key={`diff-${index}`}
          className="agent-activity-diff ml-1.5 inline-flex items-center gap-1 tabular-nums"
        >
          {part.insertions > 0 ? (
            <span className="agent-activity-diff--add">+{part.insertions}</span>
          ) : null}
          {part.deletions > 0 ? (
            <span className="agent-activity-diff--del">−{part.deletions}</span>
          ) : null}
        </span>
      );
    }
    return (
      <span
        key={`t-${index}`}
        className={cn(
          part.tone === "emphasis" && "agent-activity-label--emphasis",
          part.tone === "subtle" && "agent-activity-label--subtle",
          part.tone === "muted" && "agent-activity-label--muted",
        )}
      >
        {part.text}
      </span>
    );
  });
}

/** Work-group header from tool/thinking counts. */
export function AgentActivitySummaryLabel({
  segments,
  isActive,
  fallback,
}: {
  segments: Array<AgentThinkingSegment | AgentToolSegment>;
  isActive: boolean;
  /** Plain string fallback (narration-derived single-step labels). */
  fallback?: string;
}) {
  const useToolMix =
    segments.filter((s) => s.kind === "tool").length >= 2 ||
    (segments.some((s) => s.kind === "thinking") &&
      segments.some((s) => s.kind === "tool"));

  const content =
    useToolMix || !fallback ? (
      renderParts(
        buildActivitySummaryParts(segments, isActive ? "active" : "done"),
      )
    ) : (
      <span className="agent-activity-label--muted">{fallback}</span>
    );

  if (isActive) {
    return (
      <AgentShimmerText active>
        <span className="agent-activity-label">{content}</span>
      </AgentShimmerText>
    );
  }

  return <span className="agent-activity-label">{content}</span>;
}
