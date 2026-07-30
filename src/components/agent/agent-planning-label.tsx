"use client";

import { cn } from "@/lib/utils";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";

/**
 * Waiting chrome for a fresh assistant turn: bottom orb only.
 * Shown while generating and before any answer / tool / thinking has painted.
 * (No "Planning next moves" label — the orb already signals activity.)
 */
export function AgentPlanningNextMoves({
  className,
  showOrb = true,
}: {
  className?: string;
  showOrb?: boolean;
}) {
  if (!showOrb) return null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center py-0.5",
        className,
      )}
      data-agent-planning="true"
      data-streaming-orb="bottom"
    >
      <StreamingOrbCursor />
    </div>
  );
}
