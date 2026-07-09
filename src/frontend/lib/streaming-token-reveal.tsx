"use client";

/**
 * Plain streaming text — no per-token fade.
 * Kept as a thin wrapper so call sites stay stable after FlowToken removal.
 */
export function StreamingTokenReveal({
  text,
}: {
  text: string;
  sessionKey?: string;
  enabled?: boolean;
  durationMs?: number;
}) {
  if (!text) return null;
  return <>{text}</>;
}

export type StreamFadeConfig = {
  animation: string;
  animationDuration: string;
  animationTimingFunction: string;
};

/** Kept for code-highlight call sites; animation is a no-op visually. */
export const DEFAULT_STREAM_FADE: StreamFadeConfig = {
  animation: "none",
  animationDuration: "0ms",
  animationTimingFunction: "linear",
};

export function computeStreamTokenDurationMs(
  _elapsedSinceLastChunk: number,
  _chunkLength: number,
): number {
  return 0;
}
