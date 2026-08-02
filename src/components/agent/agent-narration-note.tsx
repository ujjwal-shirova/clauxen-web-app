"use client";

import { cn } from "@/lib/utils";
import type {
  AgentNarrationSegment,
  AgentTextSegment,
} from "@/lib/agent-segments";
import { MarkdownRenderer } from "@/components/markdown-renderer";

/**
 * Mid-turn narration — quiet prose between tools. Not private thinking,
 * not the final answer. Plain readable text with no card chrome — the
 * Cursor/Claude-style progress note the user follows while work runs.
 */
export function AgentNarrationNote({
  segment,
}: {
  segment: AgentNarrationSegment | AgentTextSegment;
}) {
  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  return (
    <div
      className={cn(
        "agent-narration min-w-0 text-[13px] font-[430] leading-[18px] tracking-[-0.01em] text-zinc-600 dark:text-zinc-400",
        segment.isStreaming
          ? "text-zinc-800 dark:text-zinc-200"
          : "animate-in fade-in duration-150",
      )}
      data-agent-segment="narration"
      data-agent-narration="true"
      data-streaming={segment.isStreaming || undefined}
    >
      <MarkdownRenderer
        content={segment.content || "…"}
        isStreaming={!!segment.isStreaming}
        showCursor={false}
        streamKey={segment.id}
      />
    </div>
  );
}
