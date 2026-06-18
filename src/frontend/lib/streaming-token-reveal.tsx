"use client";

import { useMemo } from "react";

const MIN_DURATION_MS = 12;
const MAX_DURATION_MS = 56;
const MS_PER_CHAR = 2;

export type StreamToken = {
  id: number;
  text: string;
  durationMs: number;
  delayMs: number;
};

type StreamNodeState = {
  tokens: StreamToken[];
  assembled: string;
  lastChunkAt: number;
  nextId: number;
};

const nodeSessions = new Map<string, StreamNodeState>();

function getNodeState(sessionKey: string): StreamNodeState {
  let state = nodeSessions.get(sessionKey);
  if (!state) {
    state = {
      tokens: [],
      assembled: "",
      lastChunkAt: 0,
      nextId: 0,
    };
    nodeSessions.set(sessionKey, state);
  }
  return state;
}

/** Drop cached token state when a message stream ends or the key changes. */
export function resetStreamTokenSessions(streamKey: string) {
  const prefix = `${streamKey}::`;
  for (const key of nodeSessions.keys()) {
    if (key.startsWith(prefix)) {
      nodeSessions.delete(key);
    }
  }
}

/** Fade length scales with how fast the model is streaming and how large each delta is. */
export function computeStreamTokenDurationMs(
  elapsedSinceLastChunk: number,
  chunkLength: number,
): number {
  const rateBased =
    elapsedSinceLastChunk > 0
      ? Math.min(
          MAX_DURATION_MS,
          Math.max(MIN_DURATION_MS, elapsedSinceLastChunk * 0.72),
        )
      : MIN_DURATION_MS;
  const sizeBased = Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, chunkLength * MS_PER_CHAR),
  );
  return Math.round((rateBased + sizeBased) / 2);
}

function splitRevealParts(delta: string): string[] {
  if (!delta) return [];
  const parts = delta.match(/\S+|\s+/g);
  return parts?.length ? parts : [delta];
}

function appendDelta(
  state: StreamNodeState,
  text: string,
): { tokens: StreamToken[]; freshIds: Set<number> } {
  const assembled = state.tokens.map((token) => token.text).join("");

  if (!text) {
    state.tokens = [];
    state.assembled = "";
    state.nextId = 0;
    state.lastChunkAt = 0;
    return { tokens: [], freshIds: new Set() };
  }

  if (text.length < assembled.length || !text.startsWith(assembled)) {
    state.tokens = [];
    state.assembled = "";
    state.nextId = 0;
    state.lastChunkAt = 0;
  }

  const currentAssembled = state.tokens.map((token) => token.text).join("");
  const delta = text.slice(currentAssembled.length);
  if (!delta) {
    return { tokens: state.tokens, freshIds: new Set() };
  }

  const now = performance.now();
  const elapsed = state.lastChunkAt > 0 ? now - state.lastChunkAt : 0;
  state.lastChunkAt = now;

  const chunkDurationMs = computeStreamTokenDurationMs(elapsed, delta.length);
  const parts = splitRevealParts(delta);
  const freshIds = new Set<number>();
  const perPartDuration =
    parts.length > 1
      ? Math.max(MIN_DURATION_MS, Math.round(chunkDurationMs / parts.length))
      : chunkDurationMs;
  const staggerMs = Math.min(4, Math.round(perPartDuration * 0.08));

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const token: StreamToken = {
      id: state.nextId,
      text: part,
      durationMs: perPartDuration,
      delayMs: index * staggerMs,
    };
    state.nextId += 1;
    state.tokens.push(token);
    freshIds.add(token.id);
  }

  state.assembled = text;
  return { tokens: state.tokens, freshIds };
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
  const { tokens, freshIds } = useMemo(() => {
    const state = getNodeState(sessionKey);
    return appendDelta(state, text);
  }, [sessionKey, text]);

  return (
    <>
      {tokens.map((token) => {
        const isFresh = freshIds.has(token.id);
        return (
          <span
            key={token.id}
            className={isFresh ? "stream-token-enter" : undefined}
            style={
              isFresh
                ? {
                    animationName,
                    animationDuration: `${token.durationMs}ms`,
                    animationDelay: `${token.delayMs}ms`,
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
