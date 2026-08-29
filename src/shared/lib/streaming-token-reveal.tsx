"use client";

import { useEffect, useRef, useState } from "react";

/** One React/Markdown update per paint, regardless of SSE chunk cadence. */
export function useRafBatchedText(text: string, isStreaming: boolean): string {
  const [paintedText, setPaintedText] = useState(text);
  const targetRef = useRef(text);
  const frameRef = useRef<number | null>(null);

  targetRef.current = text;

  useEffect(() => {
    if (!isStreaming) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      setPaintedText(text);
      return;
    }

    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPaintedText(targetRef.current);
    });
  }, [isStreaming, text]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // Do not leave the final answer one frame behind when the stream ends.
  return isStreaming ? paintedText : text;
}

/** Drain a burst at a steady reading pace, while catching up quickly. */
const DRAIN_BACKLOG_MS = 260;
const MAX_CHARS_PER_FRAME = 30;

type PaintSession = {
  id: string;
  displayed: string;
  target: string;
};

const paintGroups = new Map<string, PaintSession[]>();

function streamGroupKey(sessionKey: string): string {
  const cut = sessionKey.indexOf(":");
  return cut === -1 ? sessionKey : sessionKey.slice(0, cut);
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let index = 0;
  while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) {
    index += 1;
  }
  return index;
}

function resolvePaintSession(sessionKey: string, text = ""): PaintSession {
  const groupKey = streamGroupKey(sessionKey);
  let group = paintGroups.get(groupKey);
  if (!group) {
    group = [];
    paintGroups.set(groupKey, group);
  }

  let session = group.find((entry) => entry.id === sessionKey);
  if (!session && text) {
    // Streamdown may replace a text node when its Markdown tree reshapes.
    // Reuse its closest sibling session so settled prose never replays.
    session = group.find((entry) => {
      const known = entry.target || entry.displayed;
      if (!known) return false;
      if (text.startsWith(known) || known.startsWith(text)) return true;
      const shared = commonPrefixLength(known, text);
      return shared >= Math.min(4, Math.floor(Math.min(known.length, text.length) * 0.3));
    });
  }
  if (!session) {
    session = { id: sessionKey, displayed: "", target: "" };
    group.push(session);
  } else {
    session.id = sessionKey;
  }
  return session;
}

/** Advances by Unicode code points, never splitting an emoji surrogate pair. */
function advanceByCodePoints(text: string, start: number, count: number): number {
  let index = start;
  let remaining = count;
  while (index < text.length && remaining > 0) {
    const point = text.codePointAt(index);
    index += point && point > 0xffff ? 2 : 1;
    remaining -= 1;
  }
  return index;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

/** Drop paint state after a message settles or its renderer unmounts. */
export function clearStreamPaintSessions(streamKeyPrefix: string): void {
  for (const key of [...paintGroups.keys()]) {
    if (key === streamKeyPrefix || key.startsWith(streamKeyPrefix)) {
      paintGroups.delete(key);
    }
  }
}

type RevealFrame = {
  text: string;
  freshStart: number;
};

/**
 * Paints only the newest suffix. Incoming chunks are turned into a bounded
 * requestAnimationFrame backlog instead of restarting an animation per token.
 */
export function StreamingTokenReveal({
  text,
  sessionKey = "stream",
  enabled = true,
}: {
  text: string;
  sessionKey?: string;
  enabled?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const sessionRef = useRef<PaintSession | null>(null);
  const sessionKeyRef = useRef(sessionKey);
  const frameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const [frame, setFrame] = useState<RevealFrame>(() => {
    const session = resolvePaintSession(sessionKey, text);
    sessionRef.current = session;
    sessionKeyRef.current = sessionKey;
    return { text: session.displayed, freshStart: session.displayed.length };
  });

  if (sessionKeyRef.current !== sessionKey) {
    sessionKeyRef.current = sessionKey;
    sessionRef.current = resolvePaintSession(sessionKey, text);
  }

  useEffect(() => {
    const session = sessionRef.current!;
    session.target = text;

    const stop = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    if (!enabled || reducedMotion) {
      stop();
      session.displayed = text;
      setFrame({ text, freshStart: text.length });
      return;
    }

    // Markdown can reshape text nodes when a delimiter closes. Never replay
    // an already-visible block after that structural correction.
    if (!text.startsWith(session.displayed)) {
      stop();
      session.displayed = text;
      setFrame({ text, freshStart: text.length });
      return;
    }

    if (session.displayed === text || frameRef.current !== null) return;

    const paint = (now: number) => {
      const active = sessionRef.current!;
      const target = active.target;
      const displayed = active.displayed;

      if (!target.startsWith(displayed)) {
        active.displayed = target;
        setFrame({ text: target, freshStart: target.length });
        frameRef.current = null;
        return;
      }

      const remaining = target.length - displayed.length;
      if (remaining <= 0) {
        frameRef.current = null;
        return;
      }

      const elapsed = lastFrameAtRef.current
        ? Math.max(1, now - lastFrameAtRef.current)
        : 16;
      lastFrameAtRef.current = now;
      const characters = Math.min(
        MAX_CHARS_PER_FRAME,
        Math.max(1, Math.ceil((remaining * elapsed) / DRAIN_BACKLOG_MS)),
      );
      const nextEnd = advanceByCodePoints(target, displayed.length, characters);
      const next = target.slice(0, nextEnd);
      active.displayed = next;
      setFrame({ text: next, freshStart: displayed.length });

      frameRef.current =
        next === target ? null : requestAnimationFrame(paint);
    };

    frameRef.current = requestAnimationFrame(paint);
  }, [enabled, reducedMotion, sessionKey, text]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  if (!frame.text) return null;

  const settled = frame.text.slice(0, frame.freshStart);
  const fresh = frame.text.slice(frame.freshStart);
  return (
    <>
      {settled ? <span className="stream-token-stable">{settled}</span> : null}
      {fresh ? <span className="stream-token-enter">{fresh}</span> : null}
    </>
  );
}
