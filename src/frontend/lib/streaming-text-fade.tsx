"use client";

import { StreamingTokenReveal } from "@/frontend/lib/streaming-token-reveal";

const STREAM_TEXT_CLASS =
  "markdown-content whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-800";

const STREAM_REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function StreamingTextFade({
  content,
  streamKey,
  className = STREAM_TEXT_CLASS,
}: {
  content: string;
  streamKey?: string;
  className?: string;
}) {
  const resolvedKey = streamKey ?? "stream";

  return (
    <div className={className}>
      <StreamingTokenReveal
        text={content}
        sessionKey={resolvedKey}
        timingFunction={STREAM_REVEAL_EASING}
      />
    </div>
  );
}
