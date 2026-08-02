"use client";

import { cn } from "@/lib/utils";

type ChatFrostedEdgeProps = {
  placement: "top" | "bottom";
  isStreaming?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Soft white translucent veil for chat chrome — masks scroll content at the
 * top of the transcript or above the prompt composer.
 */
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
        "pointer-events-none absolute inset-x-0 z-0 overflow-hidden",
        isTop ? "top-0 h-16 sm:h-20" : "bottom-0 h-32 sm:h-36",
        className,
      )}
    >
      {/* Soft blur layer — premium frosted wash over scrolling content */}
      <div
        className={cn(
          "absolute inset-0",
          isTop
            ? "[mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)]"
            : "[mask-image:linear-gradient(to_top,black_0%,black_40%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_top,black_0%,black_40%,transparent_100%)]",
        )}
        style={{
          backdropFilter: "blur(10px) saturate(1.08)",
          WebkitBackdropFilter: "blur(10px) saturate(1.08)",
        }}
      />
      {/* Opaque → translucent canvas wash so content dissolves cleanly */}
      <div
        className={cn(
          "absolute inset-0",
          isTop
            ? "bg-gradient-to-b from-[var(--chat-canvas-bg,#f8f8f8)] from-0% via-[color-mix(in_srgb,var(--chat-canvas-bg,#f8f8f8)_72%,transparent)] via-45% to-transparent"
            : "bg-gradient-to-t from-[var(--chat-canvas-bg,#f8f8f8)] from-0% via-[color-mix(in_srgb,var(--chat-canvas-bg,#f8f8f8)_78%,transparent)] via-48% to-transparent",
        )}
      />
      {/* Subtle white highlight near the edge for a premium translucent feel */}
      <div
        className={cn(
          "absolute inset-x-0",
          isTop
            ? "top-0 h-10 bg-gradient-to-b from-white/55 to-transparent"
            : "bottom-0 h-14 bg-gradient-to-t from-white/50 to-transparent",
        )}
      />
    </div>
  );
}
