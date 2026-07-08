"use client";

import SplitText from "@flowtoken/components/SplitText";
import { animations } from "@flowtoken/utils/animations";
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
  if (!title.trim()) return null;

  return (
    <span
      className={cn(
        "truncate",
        isStreaming && "animate-in fade-in duration-300",
        className,
      )}
    >
      {isStreaming ? (
        <SplitText
          input={title}
          sep="diff"
          animation={animations.fadeIn}
          animationDuration="0.28s"
          animationTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
          animationIterationCount={1}
        />
      ) : (
        title
      )}
    </span>
  );
}
