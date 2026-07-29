"use client";

import { useId } from "react";
import { StreamingTokenReveal } from "@/lib/streaming-token-reveal";

/**
 * Per text-node streaming reveal with a stable session id (one per markdown
 * text block). Used by Streamdown component overrides during live streaming.
 */
export function StreamingRevealText({
  text,
  streamKey = "stream",
  showCursor = false,
  enabled = true,
}: {
  text: string;
  streamKey?: string;
  showCursor?: boolean;
  enabled?: boolean;
}) {
  const segmentId = useId();
  void showCursor;

  return (
    <StreamingTokenReveal
      text={text}
      sessionKey={`${streamKey}${segmentId}`}
      enabled={enabled}
    />
  );
}
