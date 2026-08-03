"use client";

import { cn } from "@/lib/utils";

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
  if (!title.trim()) return null;

  return (
    <span
      className={cn(
        // Width tracks content (no hard truncation) so the header button
        // auto-sizes to the actual title length.
        "inline-block min-w-0 max-w-full",
        isStreaming && "animate-in fade-in duration-150",
        className,
      )}
      data-streaming={isStreaming ? "true" : undefined}
    >
      {title}
    </span>
  );
}
