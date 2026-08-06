"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgentThinkingSegment } from "@/lib/agent-segments";
import { AgentShimmerText } from "./agent-trace";

/**
 * Private reasoning is never rendered. This row exposes lifecycle only;
 * user-facing progress arrives through narration segments between actions.
 */
export function AgentThinkingPhase({
  segment,
}: {
  segment: AgentThinkingSegment;
}) {
  const [isExpanded, setIsExpanded] = useState(segment.isStreaming === true);

  useEffect(() => {
    if (segment.isStreaming === true) {
      setIsExpanded(true);
    }
  }, [segment.isStreaming]);

  const duration = segment.durationSeconds;
  const title =
    segment.isStreaming === true ? (
      <>
        <AgentShimmerText key={`think-live-${segment.id}`} active>
          <span className="agent-activity-label--primary">Thinking</span>
        </AgentShimmerText>
        <span className="agent-activity-label--subtle">…</span>
      </>
    ) : duration ? (
      <>
        <span className="agent-activity-label--primary">Thought</span>
        <span className="agent-activity-label--subtle ml-1">
          for {duration}s
        </span>
      </>
    ) : (
      <span className="agent-activity-label--primary">Thought</span>
    );

  const status = segment.isStreaming
    ? "Planning the next verified action."
    : "Reasoning completed before the next action.";

  return (
    <div
      className="agent-thinking-phase max-w-full text-[13px] font-[430] leading-5 tracking-[-0.01em]"
      data-active={segment.isStreaming === true || undefined}
      data-agent-step="thinking"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="group inline-flex min-h-[1.35rem] max-w-full items-center gap-1 rounded-md text-left text-zinc-500 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
        aria-expanded={isExpanded}
      >
        {title}
        <ChevronDown
          className={`size-3.5 shrink-0 text-zinc-400 opacity-0 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${
            isExpanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isExpanded ? "mt-1 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!isExpanded}
      >
        <div className="overflow-hidden">
          <p className="px-0.5 text-[13px] leading-5 text-zinc-400">{status}</p>
        </div>
      </div>
    </div>
  );
}
