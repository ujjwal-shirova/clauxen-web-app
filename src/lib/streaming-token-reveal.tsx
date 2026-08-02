"use client";

import { useEffect, useRef } from "react";

/** Soften first-token paint: settle sooner once any chunk lands. */
const MIN_DURATION_MS = 55;
const MAX_DURATION_MS = 130;
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

  // After a long pause (tools / thinking), catch up instantly — long fades
  // after tool rounds feel laggy and unresponsive.
  if (elapsedSinceLastChunk > 400) {
    return 70;
  }

  if (elapsedSinceLastChunk <= 0) {
    duration = 80;
  } else if (elapsedSinceLastChunk < FAST_GAP_MS) {
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(110, 55 + elapsedSinceLastChunk * 1.75),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.22),
    );
  }

  const sizeBoost = Math.min(8, Math.sqrt(Math.max(0, chunkLength)) * 1.2);
  return Math.round(
    Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration + sizeBoost)),
  );
}

/** Shared prefix length — survives citation rewrites mid-stream without full wipe. */
export function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let index = 0;
  while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) {
    index += 1;
  }
  return index;
}

type PaintSession = {
  id: string;
  prev: string;
  settled: string;
  delta: string;
  duration: number;
  lastAt: number;
};

/**
 * Survive Streamdown remounts: paint state lives outside React so growing
 * text nodes don't flash-delete when the markdown AST reshuffles.
 */
const paintGroups = new Map<string, PaintSession[]>();

function streamGroupKey(sessionKey: string): string {
  const cut = sessionKey.indexOf(":");
  return cut === -1 ? sessionKey : sessionKey.slice(0, cut);
}

function resolvePaintSession(sessionKey: string, text: string): PaintSession {
  const groupKey = streamGroupKey(sessionKey);
  let group = paintGroups.get(groupKey);
  if (!group) {
    group = [];
    paintGroups.set(groupKey, group);
  }

  let hit = group.find((session) => session.id === sessionKey);

  if (!hit) {
    // Remounted text node: reuse the session that already painted this growth.
    hit = group.find((session) => {
      if (!session.prev) return false;
      if (text.startsWith(session.prev)) return true;
      const shared = commonPrefixLength(session.prev, text);
      return shared >= Math.min(24, Math.floor(session.prev.length * 0.7));
    });
  }

  if (!hit) {
    hit = {
      id: sessionKey,
      prev: "",
      settled: "",
      delta: "",
      duration: 120,
      lastAt: 0,
    };
    group.push(hit);
  } else {
    hit.id = sessionKey;
  }

  return hit;
}

/** Drop paint state when a stream session finishes. */
export function clearStreamPaintSessions(streamKeyPrefix: string): void {
  for (const key of [...paintGroups.keys()]) {
    if (key === streamKeyPrefix || key.startsWith(streamKeyPrefix)) {
      paintGroups.delete(key);
    }
  }
}

export type StreamFadeConfig = {
  animation: string;
  animationDuration: string;
  animationTimingFunction: string;
};

export const DEFAULT_STREAM_FADE: StreamFadeConfig = {
  animation: "stream-token-fade",
  animationDuration: "55ms",
  animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};

/**
 * Rate-adaptive per-chunk fade for newly appended text during streaming.
 * Settled prefix stays static; only the delta gets the enter animation.
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
  // Touch a ref so React still re-renders when parent passes new text.
  const versionRef = useRef(0);

  useEffect(() => {
    if (enabled) return;
    // Defer cleanup so the settled span stays mounted through the stream→done flip.
    const timer = window.setTimeout(() => {
      clearStreamPaintSessions(streamGroupKey(sessionKey));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [enabled, sessionKey]);

  if (!text) return null;

  const session = resolvePaintSession(sessionKey, text);

  // Settled: collapse into one stable span using the same element type as the
  // streaming paint path — never swap to a bare text node (that blinks).
  if (!enabled) {
    if (session.prev !== text || session.delta) {
      session.settled = text;
      session.delta = "";
      session.prev = text;
    }
    return <span className="stream-token-stable">{session.settled || text}</span>;
  }

  if (text !== session.prev) {
    const previous = session.prev;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const prefixLen =
      previous.length === 0 ? 0 : commonPrefixLength(previous, text);
    const isGrowth =
      prefixLen === previous.length && text.length >= previous.length;
    const deltaLength = Math.max(0, text.length - prefixLen);
    const elapsed = session.lastAt > 0 ? now - session.lastAt : 0;

    // Large non-growth rewrites (citation reshuffle / AST remount) must not
    // re-animate the whole body — that is the gray↔white flicker.
    const settleWithoutFade =
      !isGrowth && (prefixLen === 0 || deltaLength > 48 || previous.length > 0);

    if (settleWithoutFade) {
      session.settled = text;
      session.delta = "";
      session.duration = 0;
    } else {
      session.duration =
        durationMs ??
        computeStreamTokenDurationMs(isGrowth ? elapsed : 0, deltaLength);
      session.settled = text.slice(0, prefixLen);
      session.delta = text.slice(prefixLen);
    }
    session.lastAt = now;
    session.prev = text;
    versionRef.current += 1;
  }

  // Prefer a single stable span once the delta has landed — avoids a
  // fragment remount when streaming ends mid-paint.
  if (!session.delta) {
    return <span className="stream-token-stable">{session.settled || text}</span>;
  }

  return (
    <>
      {session.settled ? (
        <span className="stream-token-stable">{session.settled}</span>
      ) : null}
      <span
        className="stream-token-enter"
        style={{
          animationDuration: `${session.duration}ms`,
        }}
      >
        {session.delta}
      </span>
    </>
  );
}
