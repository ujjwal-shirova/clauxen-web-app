"use client";

import { cn } from "@/lib/utils";

type ChatFrostedEdgeProps = {
  placement: "top" | "bottom";
  isStreaming?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Opaque canvas fade for chat chrome — masks scroll content at top/bottom. */
export function ChatFrostedEdge({
  placement,
  className,
  style,
}: ChatFrostedEdgeProps) {
  const isTop = placement === "top";

  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "pointer-events-none absolute inset-x-0 z-0",
        isTop ? "top-0 h-20 sm:h-24" : "bottom-0 h-36 sm:h-40",
        className,
      )}
    >
      <div
        className={cn(
          "h-full w-full",
          isTop
            ? "bg-gradient-to-b from-[var(--chat-canvas-bg,#f8f8f8)] from-55% to-transparent"
            : "bg-gradient-to-t from-[var(--chat-canvas-bg,#f8f8f8)] from-55% to-transparent",
        )}
      />
    </div>
  );
}
