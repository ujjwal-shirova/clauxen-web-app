"use client";

import { useRef } from "react";
import TokenizedText from "@flowtoken/components/SplitText";
import { animations as flowtokenAnimations } from "@flowtoken/utils/animations";

/** Visible ink-fade per FlowToken guidance — long enough to read, short enough to track live tokens. */
const MIN_DURATION_MS = 180;
const MAX_DURATION_MS = 520;
const FAST_GAP_MS = 28;

/**
 * Duration scales with inter-chunk gap so animation speed tracks the model's token rate.
 * Kept short enough that fast streams feel live, long enough that the ink-fade is visible.
 */
export function computeStreamTokenDurationMs(
  elapsedSinceLastChunk: number,
  chunkLength: number,
): number {
  let duration: number;

  if (elapsedSinceLastChunk <= 0) {
    duration = 280;
  } else if (elapsedSinceLastChunk < FAST_GAP_MS) {
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(360, 120 + elapsedSinceLastChunk * 4.5),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.55),
    );
  }

  const sizeBoost = Math.min(40, Math.sqrt(chunkLength) * 5);
  return Math.round(
    Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration + sizeBoost)),
  );
}

export function StreamingTokenReveal({
  text,
  sessionKey,
  animationName = "fadeIn",
  timingFunction = "cubic-bezier(0.22, 1, 0.36, 1)",
}: {
  text: string;
  sessionKey: string;
  animationName?: string;
  timingFunction?: string;
  /** @deprecated cursor rendering was removed app-wide; kept for call-site compat. */
  showCursor?: boolean;
}) {
  const prevTextRef = useRef("");
  const prevKeyRef = useRef(sessionKey);
  const lastChunkAtRef = useRef(0);
  const durationRef = useRef(160);
  const resetCounterRef = useRef(0);

  if (prevKeyRef.current !== sessionKey) {
    prevKeyRef.current = sessionKey;
    prevTextRef.current = "";
    lastChunkAtRef.current = 0;
    durationRef.current = 160;
    resetCounterRef.current = 0;
  }

  if (text !== prevTextRef.current) {
    const previous = prevTextRef.current;
    const now = performance.now();
    const isGrowth = previous.length > 0 && text.startsWith(previous);
    const deltaLength = isGrowth ? text.length - previous.length : text.length;
    const elapsed = lastChunkAtRef.current > 0 ? now - lastChunkAtRef.current : 0;

    if (previous && !isGrowth) {
      // Flowtoken diff mode is append-oriented. Remount on rewrites so its
      // internal token source cache never treats repeated text as duplicated
      // stream growth.
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
    />
  );
}
