"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Fast streams: short enough to track token cadence; slow streams: longer, smoother settle. */
const MIN_DURATION_MS = 32;
const MAX_DURATION_MS = 160;
const FAST_GAP_MS = 28;
const MAX_TOKENS = 500;

export type StreamToken = {
  id: number;
  text: string;
  durationMs: number;
};

type RevealSession = {
  sessionKey: string;
  assembled: string;
  tokens: StreamToken[];
  nextId: number;
  lastChunkAt: number;
};

export function resetStreamTokenSessions(_streamKey: string) {
  // Tokens are held in component state; nothing global to clear.
}

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
    duration = 56;
  } else if (elapsedSinceLastChunk < FAST_GAP_MS) {
    // High throughput — quick settle but keep a perceptible ink fade.
    duration = Math.max(
      MIN_DURATION_MS,
      Math.min(72, 30 + elapsedSinceLastChunk * 1.25),
    );
  } else {
    duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.44),
    );
  }

  // Small boost for larger chunks so the fade has time to read, but capped
  // so it never masks fast token cadence.
  const sizeBoost = Math.min(22, Math.sqrt(chunkLength) * 3.2);
  return Math.round(
    Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration + sizeBoost)),
  );
}

function appendChunk(session: RevealSession, text: string) {
  if (!text) {
    session.assembled = "";
    session.tokens = [];
    session.nextId = 0;
    session.lastChunkAt = 0;
    return;
  }

  if (
    text.length < session.assembled.length ||
    !text.startsWith(session.assembled)
  ) {
    session.assembled = "";
    session.tokens = [];
    session.nextId = 0;
    session.lastChunkAt = 0;
  }

  const delta = text.slice(session.assembled.length);
  if (!delta) return;

  const now = performance.now();
  const elapsed = session.lastChunkAt > 0 ? now - session.lastChunkAt : 0;
  session.lastChunkAt = now;

  session.tokens.push({
    id: session.nextId,
    text: delta,
    durationMs: computeStreamTokenDurationMs(elapsed, delta.length),
  });
  session.nextId += 1;

  if (session.tokens.length > MAX_TOKENS) {
    const overflow = session.tokens.length - MAX_TOKENS;
    session.tokens = session.tokens.slice(overflow);
  }

  session.assembled = text;
}

export function StreamingTokenReveal({
  text,
  sessionKey,
  animationName = "clauxen-token-fade",
  timingFunction = "cubic-bezier(0.22, 1, 0.36, 1)",
}: {
  text: string;
  sessionKey: string;
  animationName?: string;
  timingFunction?: string;
}) {
  const sessionRef = useRef<RevealSession | null>(null);
  const [tokens, setTokens] = useState<StreamToken[]>([]);

  if (sessionRef.current === null) {
    sessionRef.current = {
      sessionKey,
      assembled: "",
      tokens: [],
      nextId: 0,
      lastChunkAt: 0,
    };
  }

  useLayoutEffect(() => {
    const session = sessionRef.current!;
    if (session.sessionKey !== sessionKey) {
      session.sessionKey = sessionKey;
      session.assembled = "";
      session.tokens = [];
      session.nextId = 0;
      session.lastChunkAt = 0;
      setTokens([]);
      return;
    }

    appendChunk(session, text);
    setTokens(session.tokens.length > 0 ? session.tokens.slice() : []);
  }, [text, sessionKey]);

  if (!text) return null;

  if (tokens.length === 0) {
    return (
      <span className="stream-token-enter stream-token-pending">{text}</span>
    );
  }

  return (
    <>
      {tokens.map((token, index) => {
        const isActive = index === tokens.length - 1;
        return (
          <span
            key={token.id}
            className={isActive ? "stream-token-enter" : "stream-token-stable"}
            style={
              isActive
                ? {
                    animationName,
                    animationDuration: `${token.durationMs}ms`,
                    animationTimingFunction: timingFunction,
                    animationIterationCount: 1,
                  }
                : undefined
            }
          >
            {token.text}
          </span>
        );
      })}
    </>
  );
}
