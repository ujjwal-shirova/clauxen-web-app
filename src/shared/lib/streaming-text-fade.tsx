"use client";

import { useSmoothStreamingText } from "@/lib/smooth-streaming-text";

/** Lightweight plain-text view using the shared lossless stream smoother. */
export function StreamingTextFade({
  content,
  streamKey = "stream",
  className = "markdown-content whitespace-pre-wrap break-words text-[13px] leading-[18px] text-zinc-800",
}: {
  content: string;
  streamKey?: string;
  className?: string;
}) {
  const visibleText = useSmoothStreamingText(content, { streamKey });

  return (
    <div className={className} data-streaming>
      {visibleText}
    </div>
  );
}
