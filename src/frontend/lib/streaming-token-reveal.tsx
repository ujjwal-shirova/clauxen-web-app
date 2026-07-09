"use client";

import { useRef } from "react";
import TokenizedText from "@flowtoken/components/SplitText";
import { animations as flowtokenAnimations } from "@flowtoken/utils/animations";

/** Visible fade band — FlowToken docs use ~0.5s; we adapt per chunk arrival rate. */
const MIN_DURATION_MS = 120;
const MAX_DURATION_MS = 560;
/** Gaps below this are treated as high-throughput token bursts. */
const FAST_BURST_GAP_MS = 32;

/**
 * Maps inter-chunk elapsed time to animation duration so fast streams stay
 * snappy and slow streams get a longer, readable ink-fade.
 */
export function computeStreamTokenDurationMs(
  elapsedSinceLastChunk: number,
  chunkLength: number,
): number {
  let duration: number;

  if (elapsedSinceLastChunk <= 0) {
    duration = 300;
  } else if (elapsedSinceLastChunk < FAST_BURST_GAP_MS) {
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(340, 100 + elapsedSinceLastChunk * 5),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.72),
    );
  }

  const sizeBoost = Math.min(48, Math.sqrt(Math.max(1, chunkLength)) * 6);
  return Math.round(
    Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration + sizeBoost)),
  );
}

export function StreamingTokenReveal({
  text,
  sessionKey,
  animationName = "fadeIn",
  timingFunction = "cubic-bezier(0.22, 1, 0.36, 1)",
  enabled = true,
}: {
  text: string;
  sessionKey: string;
  animationName?: string;
  timingFunction?: string;
  /** @deprecated cursor rendering was removed app-wide; kept for call-site compat. */
  showCursor?: boolean;
  /** FlowToken: set null/false on completed messages to skip animation. */
  enabled?: boolean;
}) {
  const prevTextRef = useRef("");
  const prevKeyRef = useRef(sessionKey);
  const lastChunkAtRef = useRef(0);
  const durationRef = useRef(300);
  const resetCounterRef = useRef(0);

  if (prevKeyRef.current !== sessionKey) {
    prevKeyRef.current = sessionKey;
    prevTextRef.current = "";
    lastChunkAtRef.current = 0;
    durationRef.current = 300;
    resetCounterRef.current = 0;
  }

  if (text !== prevTextRef.current) {
    const previous = prevTextRef.current;
    const now = performance.now();
    const isGrowth = previous.length > 0 && text.startsWith(previous);
    const deltaLength = isGrowth ? text.length - previous.length : text.length;
    const elapsed = lastChunkAtRef.current > 0 ? now - lastChunkAtRef.current : 0;

    if (previous && !isGrowth) {
      resetCounterRef.current += 1;
    }

    durationRef.current = computeStreamTokenDurationMs(
      isGrowth ? elapsed : 0,
      Math.max(0, deltaLength),
    );
    lastChunkAtRef.current = now;
    prevTextRef.current = text;
  }

  if (!text) return null;

  if (!enabled) {
    return <>{text}</>;
  }

  const resolvedAnimation =
    flowtokenAnimations[animationName as keyof typeof flowtokenAnimations] ??
    animationName;

  return (
    <TokenizedText
      key={`${sessionKey}:${resetCounterRef.current}`}
      input={text}
      sep="diff"
      animation={resolvedAnimation}
      animationDuration={`${durationRef.current}ms`}
      animationTimingFunction={timingFunction}
      animationIterationCount={1}
      chunkDurationMs={durationRef.current}
    />
  );
}
