"use client";

import { cn } from "@/frontend/lib/utils";
import type {
  AgentNarrationSegment,
  AgentTextSegment,
} from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";

/**
 * Mid-turn narration — user-facing prose between tools.
 * Serif / document voice — distinct from sans interleaved thinking.
 */
export function AgentNarrativeStep({
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
        "agent-narration relative grid min-w-0 grid-cols-[12px_minmax(0,1fr)] gap-2.5 animate-in fade-in duration-200",
      )}
      data-agent-segment="narration"
      data-assistant-content="true"
    >
      <span
        className={cn(
          "relative z-[1] mt-[7px] ml-[2px] block h-[7px] w-[7px] rotate-45 border border-zinc-300 bg-white",
          segment.isStreaming && "border-zinc-500",
        )}
        aria-hidden
      />
      <div
        className={cn(
          "rounded-xl bg-zinc-50/55 px-3 py-2 font-serif text-[15px] leading-[1.58] tracking-[-0.008em] text-zinc-700 [&_.markdown-content]:!font-serif [&_.markdown-content_*]:!font-serif",
          segment.isStreaming && "text-zinc-800",
        )}
      >
        <MarkdownRenderer
          content={segment.content || "…"}
          isStreaming={!!segment.isStreaming}
          showCursor={false}
          lightweightStream={!!segment.isStreaming}
        />
      </div>
    </div>
  );
}
