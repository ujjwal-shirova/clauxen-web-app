"use client";

import { StreamingTokenReveal } from "@/lib/streaming-token-reveal";

/** Lightweight stream text with rate-adaptive fade on new chunks. */
export function StreamingTextFade({
  content,
  streamKey = "stream",
  className = "markdown-content whitespace-pre-wrap break-words text-[13px] leading-[18px] text-zinc-800",
}: {
  content: string;
  streamKey?: string;
  className?: string;
}) {
  return (
    <div className={className} data-streaming>
      <StreamingTokenReveal text={content} sessionKey={streamKey} enabled />
    </div>
  );
}
