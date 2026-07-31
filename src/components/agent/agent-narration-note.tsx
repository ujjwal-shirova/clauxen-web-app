"use client";

import { cn } from "@/lib/utils";
import type {
  AgentNarrationSegment,
  AgentTextSegment,
} from "@/lib/agent-segments";
import { MarkdownRenderer } from "@/components/markdown-renderer";

/**
 * Mid-turn narration — quiet prose between tools. Not private thinking,
 * not the final answer. Plain readable text with no card chrome.
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
        "agent-narration min-w-0 animate-in fade-in duration-200 text-[14px] font-[430] leading-[1.6] tracking-[-0.01em] text-zinc-700",
        segment.isStreaming && "text-zinc-900",
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
