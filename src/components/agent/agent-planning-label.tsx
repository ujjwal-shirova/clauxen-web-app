"use client";

import { cn } from "@/lib/utils";
import { AgentShimmerText } from "@/components/agent/agent-trace";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";

/**
 * Waiting chrome for a fresh assistant turn: shimmer "Planning next moves"
 * plus the bottom orb. Shown only while generating and before any answer
 * text / tool / thinking work has painted.
 */
export function AgentPlanningNextMoves({
  className,
  showOrb = true,
}: {
  className?: string;
  showOrb?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 animate-in fade-in duration-200",
        className,
      )}
      data-agent-planning="true"
    >
      <div className="text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-400">
        <AgentShimmerText active>Planning next moves</AgentShimmerText>
      </div>
      {showOrb ? (
        <div
          className="flex items-center py-0.5 transition-opacity duration-200"
          data-streaming-orb="bottom"
        >
          <StreamingOrbCursor />
        </div>
      ) : null}
    </div>
  );
}
