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
 * Reasoning phase — Cursor-style muted "Thought for Ns" row.
 * Chevron appears on hover; stays visible while expanded.
 * Body is plain low-intensity text (no card chrome).
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
        <span className="agent-activity-label--muted">Thinking</span>
        <span className="agent-activity-label--subtle">…</span>
      </AgentShimmerText>
    ) : duration ? (
      <>
        <span className="agent-activity-label--muted">Thought</span>
        <span className="agent-activity-label--subtle">
          {" "}
          for {duration}s
        </span>
      </>
    ) : (
      <span className="agent-activity-label--muted">Thought</span>
    );

  const content = body.length > 0 ? body : null;

  return (
    <AgentTraceBlock
      title={title}
      chevronMode="hover-collapsed"
      isActive={segment.isStreaming === true}
      className="agent-thinking-phase"
      headerClassName="agent-thinking-phase__header"
      contentClassName="agent-thinking-phase__body"
      titleClassName="text-inherit"
    >
      {content ? (
        <div className="agent-thinking-body max-w-none text-[13px] leading-[1.55] text-zinc-500">
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
