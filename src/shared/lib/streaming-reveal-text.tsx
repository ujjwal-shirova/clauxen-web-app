"use client";

import { StreamingTokenReveal } from "@/lib/streaming-token-reveal";

/**
 * Per text-node streaming reveal. Session identity comes only from `streamKey`
 * (and paint-group common-prefix recovery) — never `useId()`, which remounts
 * with Streamdown AST reshuffles and re-fades the entire settled text (gray flicker).
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
  void showCursor;

  return (
    <StreamingTokenReveal
      text={text}
      sessionKey={streamKey}
      enabled={enabled}
    />
  );
}
