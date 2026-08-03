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
        <span className="agent-activity-label--subtle">
          {" "}
          for {duration}s
        </span>
      </>
    ) : (
      <span className="agent-activity-label--primary">Thought</span>
    );

  return (
    <div
      className="agent-thinking-phase inline-flex min-h-[1.35rem] max-w-full items-center text-[13px] font-[430] leading-5 tracking-[-0.01em]"
      data-active={segment.isStreaming === true || undefined}
      data-agent-step="thinking"
    >
      {title}
    </div>
  );
}
