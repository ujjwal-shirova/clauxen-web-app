"use client";

import { cn } from "@/frontend/lib/utils";

type ChatFrostedEdgeProps = {
  placement: "top" | "bottom";
  isStreaming?: boolean;
  className?: string;
};

/** Frost for chat chrome: header = blur-only glass; bottom = soft tint over prompt. */
export function ChatFrostedEdge({
  placement,
  isStreaming = false,
  className,
}: ChatFrostedEdgeProps) {
  const isTop = placement === "top";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-0",
        isTop ? "top-0 h-20 sm:h-24" : "bottom-0 z-10 h-32 sm:h-36",
        className,
      )}
    >
      <div
        className={cn(
          "h-full w-full",
          isTop
            ? cn(
                "bg-transparent [mask-image:linear-gradient(to_bottom,black_50%,transparent)]",
                !isStreaming && "backdrop-blur-md",
              )
            : cn(
                "bg-gradient-to-t from-white via-white/80 to-transparent [mask-image:linear-gradient(to_top,black_55%,transparent)]",
                !isStreaming && "backdrop-blur-xl backdrop-saturate-150",
              ),
        )}
      />
    </div>
  );
}
