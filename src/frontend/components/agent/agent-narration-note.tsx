"use client";

import { cn } from "@/frontend/lib/utils";
import type {
  AgentNarrationSegment,
  AgentTextSegment,
} from "@/frontend/lib/agent-segments";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Mid-turn narration — a user-facing progress note emitted by the model
 * before/between tool calls. Visually quieter than thinking and quieter than
 * the final answer: serif italic, no card chrome, no border. Reads like a
 * margin whisper that the assistant is on the right track.
 *
 * Distinct from thinking (which is the model's private reasoning block) —
 * narration is meant for the user to read.
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
    <AgentTraceBlock
      variant="narration"
      isActive={!!segment.isStreaming}
      title={
        <span
          className={cn(
            "block max-w-full font-serif text-[14.5px] italic leading-[1.55] tracking-[-0.005em] text-zinc-600",
            segment.isStreaming && "text-zinc-800",
          )}
        >
          {segment.isStreaming ? (
            <AgentShimmerText>{segment.content || "…"}</AgentShimmerText>
          ) : (
            <MarkdownRenderer
              content={segment.content}
              isStreaming={false}
              showCursor={false}
              lightweightStream={false}
            />
          )}
        </span>
      }
    />
  );
}
