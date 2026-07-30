"use client";

import { useEffect, useRef } from "react";

/** Visible ink-fade — tracks token rate; starts immediately on first paint. */
const MIN_DURATION_MS = 70;
const MAX_DURATION_MS = 320;
const FAST_GAP_MS = 24;

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
    duration = 90;
  } else if (elapsedSinceLastChunk < FAST_GAP_MS) {
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(180, 50 + elapsedSinceLastChunk * 3.5),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.4),
    );
  }

  const sizeBoost = Math.min(24, Math.sqrt(Math.max(0, chunkLength)) * 3);
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
  animationDuration: "140ms",
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
    if (!enabled) {
      clearStreamPaintSessions(streamGroupKey(sessionKey));
    }
  }, [enabled, sessionKey]);

  if (!enabled) {
    return text ? <>{text}</> : null;
  }

  if (!text) return null;

  const session = resolvePaintSession(sessionKey, text);

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

    session.duration =
      durationMs ??
      computeStreamTokenDurationMs(isGrowth ? elapsed : 0, deltaLength);
    session.settled = text.slice(0, prefixLen);
    session.delta = text.slice(prefixLen);
    session.lastAt = now;
    session.prev = text;
    versionRef.current += 1;
  }

  return (
    <>
      {session.settled ? (
        <span className="stream-token-stable">{session.settled}</span>
      ) : null}
      {session.delta ? (
        <span
          className="stream-token-enter"
          style={{
            animationDuration: `${session.duration}ms`,
          }}
        >
          {session.delta}
        </span>
      ) : null}
    </>
  );
}
