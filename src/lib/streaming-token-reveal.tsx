"use client";

import { useRef } from "react";

/** Visible ink-fade — long enough to read, short enough to track live tokens. */
const MIN_DURATION_MS = 120;
const MAX_DURATION_MS = 420;
const FAST_GAP_MS = 28;

/**
 * Duration scales with inter-chunk gap so animation speed tracks the model's
 * token rate. Kept short enough that fast streams feel live.
 */
export function computeStreamTokenDurationMs(
  elapsedSinceLastChunk: number,
  chunkLength: number,
): number {
  let duration: number;

  if (elapsedSinceLastChunk <= 0) {
    duration = 220;
  } else if (elapsedSinceLastChunk < FAST_GAP_MS) {
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(280, 90 + elapsedSinceLastChunk * 4.5),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.5),
    );
  }

  const sizeBoost = Math.min(36, Math.sqrt(Math.max(0, chunkLength)) * 4);
  return Math.round(
    Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration + sizeBoost)),
  );
}

export type StreamFadeConfig = {
  animation: string;
  animationDuration: string;
  animationTimingFunction: string;
};

export const DEFAULT_STREAM_FADE: StreamFadeConfig = {
  animation: "stream-token-fade",
  animationDuration: "280ms",
  animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};

/**
 * Rate-adaptive per-chunk fade for newly appended text during streaming.
 * Settled prefix stays static; only the delta gets the enter animation.
 * (CSS-only — no FlowToken dependency.)
 */
export function StreamingTokenReveal({
  text,
  sessionKey = "stream",
  enabled = true,
  durationMs,
}: {
  text: string;
  sessionKey?: string;
  enabled?: boolean;
  durationMs?: number;
}) {
  const prevTextRef = useRef("");
  const prevKeyRef = useRef(sessionKey);
  const lastChunkAtRef = useRef(0);
  const durationRef = useRef(180);
  const settledRef = useRef("");
  const deltaRef = useRef("");

  if (prevKeyRef.current !== sessionKey) {
    prevKeyRef.current = sessionKey;
    prevTextRef.current = "";
    lastChunkAtRef.current = 0;
    durationRef.current = 180;
    settledRef.current = "";
    deltaRef.current = "";
  }

  if (text !== prevTextRef.current) {
    const previous = prevTextRef.current;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const isGrowth = previous.length > 0 && text.startsWith(previous);
    const deltaLength = isGrowth ? text.length - previous.length : text.length;
    const elapsed = lastChunkAtRef.current > 0 ? now - lastChunkAtRef.current : 0;

    durationRef.current =
      durationMs ??
      computeStreamTokenDurationMs(isGrowth ? elapsed : 0, Math.max(0, deltaLength));

    if (isGrowth) {
      settledRef.current = previous;
      deltaRef.current = text.slice(previous.length);
    } else {
      settledRef.current = "";
      deltaRef.current = text;
    }

    lastChunkAtRef.current = now;
    prevTextRef.current = text;
  }

  if (!text) return null;

  if (!enabled) {
    return <>{text}</>;
  }

  return (
    <>
      {settledRef.current ? (
        <span className="stream-token-stable">{settledRef.current}</span>
      ) : null}
      {deltaRef.current ? (
        <span
          className="stream-token-enter"
          style={{
            animationDuration: `${durationRef.current}ms`,
          }}
        >
          {deltaRef.current}
        </span>
      ) : null}
    </>
  );
}
