"use client";

import { useId } from "react";
import { StreamingTokenReveal } from "@/frontend/lib/streaming-token-reveal";

const STREAM_REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Per text-node streaming reveal with a stable session id (one per markdown text block).
 */
export function StreamingRevealText({
  text,
  streamKey = "stream",
  showCursor = false,
}: {
  text: string;
  streamKey?: string;
  showCursor?: boolean;
}) {
  const segmentId = useId();

  return (
    <StreamingTokenReveal
      text={text}
      sessionKey={`${streamKey}${segmentId}`}
      animationName="fadeIn"
      timingFunction={STREAM_REVEAL_EASING}
      showCursor={showCursor}
    />
  );
}
