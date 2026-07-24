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
        "truncate",
        isStreaming && "animate-in fade-in duration-150",
        className,
      )}
      data-streaming={isStreaming ? "true" : undefined}
    >
      {title}
    </span>
  );
}
