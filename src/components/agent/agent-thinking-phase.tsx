"use client";

import { useMemo } from "react";
import type { AgentThinkingSegment } from "@/lib/agent-segments";
import { parseThinkingMarkup } from "@/lib/agent-transcript-markup";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

function stripItalicWrapper(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("*") && trimmed.endsWith("*")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

/**
 * A reasoning phase inside a work group. Collapsed to a single muted line
 * ("Thought for 4s") once finished, shimmering "Thinking…" while live. The
 * prose carries the summary — no heading markup.
 */
export function AgentThinkingPhase({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const parsed = useMemo(
    () => parseThinkingMarkup(segment.content),
    [segment.content],
  );
  const body = stripItalicWrapper(parsed.body);
  const duration = segment.durationSeconds;
  const title =
    segment.isStreaming === true ? (
      <AgentShimmerText key={`think-live-${segment.id}`} active>
        Thinking…
      </AgentShimmerText>
    ) : duration ? (
      `Thought for ${duration} second${duration === 1 ? "" : "s"}`
    ) : (
      "Thought"
    );

  const content = body.length > 0 ? body : null;

  return (
    <AgentTraceBlock
      title={title}
      showChevron
      isActive={segment.isStreaming === true}
      className="agent-thinking-phase"
      headerClassName="agent-thinking-phase__header"
      contentClassName="agent-thinking-phase__body"
    >
      {content ? (
        <div className="thinking-block max-w-none text-[13px] leading-5.5 text-zinc-600">
          <AssistantContentRenderer
            content={content}
            isStreaming={false}
            detailLevel="full"
          />
        </div>
      ) : (
        <p className="text-[13px] italic text-zinc-400">
          Internal reasoning hidden.
        </p>
      )}
    </AgentTraceBlock>
  );
}
