"use client";

import { useStreamingAnimateText } from "@/frontend/lib/streaming-text-animation";
import { cn } from "@/frontend/lib/utils";

type StreamingChatTitleProps = {
  title: string;
  isStreaming?: boolean;
  className?: string;
};

export function StreamingChatTitle({
  title,
  isStreaming = false,
  className,
}: StreamingChatTitleProps) {
  const { animateText } = useStreamingAnimateText({
    streamKey: `title-${title.slice(0, 24)}`,
    animation: "clauxen-token-fade",
    animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

  if (!title.trim()) return null;

  return (
    <span
      className={cn(
        "truncate",
        isStreaming && "animate-in fade-in duration-300",
        className,
      )}
    >
      {isStreaming ? animateText(title) : title}
    </span>
  );
}
