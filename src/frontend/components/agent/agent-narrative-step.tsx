"use client";

import { cn } from "@/frontend/lib/utils";
import type { AgentTextSegment } from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";

/**
 * Mid-turn narration — user-facing prose between tools.
 * Serif / document voice — distinct from sans interleaved thinking.
 */
export function AgentNarrativeStep({
  segment,
}: {
  segment: AgentTextSegment;
}) {
  if (!segment.content.trim() && !segment.isStreaming) {
    return null;
  }

  return (
    <div
      className={cn(
        "agent-narration min-w-0 animate-in fade-in duration-200 py-1",
        segment.isStreaming && "opacity-95",
      )}
      data-agent-segment="narration"
      data-assistant-content="true"
    >
      <div
        className={cn(
          "font-serif text-[16.5px] leading-[1.65] tracking-[-0.01em] text-zinc-900",
          segment.isStreaming && "shimmer-text",
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
