"use client";

import { cn } from "@/lib/utils";

type StreamingOrbCursorProps = {
  className?: string;
};

/**
 * Streaming caret orb — pulses ink ↔ muted while generating.
 * One consistent size for waiting + mid-stream (no large→small jump).
 */
export function StreamingOrbCursor({ className }: StreamingOrbCursorProps) {
  return (
    <span
      className={cn(
        "streaming-orb-cursor inline-flex h-3.5 w-3.5 shrink-0 align-middle",
        className,
      )}
      aria-hidden
    >
      <span className="orb-cursor-core" />
    </span>
  );
}
