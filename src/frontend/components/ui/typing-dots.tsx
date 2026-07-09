"use client";

import { cn } from "@/frontend/lib/utils";

/**
 * Minimal three-dot indicator for title / sidebar streaming labels.
 * Message streaming uses StreamingOrbCursor instead.
 */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-[3px]", className)}
      aria-hidden
    >
      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s] [animation-duration:0.9s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s] [animation-duration:0.9s]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-zinc-400 [animation-duration:0.9s]" />
    </span>
  );
}
