"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_GRAPHEMES_PER_SECOND = 48;
const MAX_GRAPHEMES_PER_SECOND = 420;
const TARGET_BACKLOG_SECONDS = 0.14;
const MAX_GRAPHEMES_PER_FRAME = 32;

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Return a UTF-16 boundary without splitting emoji or combining characters. */
function advanceGraphemes(
  text: string,
  start: number,
  graphemeCount: number,
): number {
  if (start >= text.length || graphemeCount <= 0) return start;

  if (graphemeSegmenter) {
    let end = start;
    let remaining = graphemeCount;
    for (const segment of graphemeSegmenter.segment(text.slice(start))) {
      end = start + segment.index + segment.segment.length;
      remaining -= 1;
      if (remaining === 0) break;
    }
    return end;
  }

  let end = start;
  let remaining = graphemeCount;
  while (end < text.length && remaining > 0) {
    const point = text.codePointAt(end);
    end += point && point > 0xffff ? 2 : 1;
    remaining -= 1;
  }
  return end;
}

function countGraphemesUpTo(
  text: string,
  start: number,
  limit: number,
): number {
  if (start >= text.length) return 0;
  if (graphemeSegmenter) {
    let count = 0;
    for (const _segment of graphemeSegmenter.segment(text.slice(start))) {
      count += 1;
      if (count === limit) break;
    }
    return count;
  }

  let count = 0;
  let index = start;
  while (index < text.length && count < limit) {
    const point = text.codePointAt(index);
    index += point && point > 0xffff ? 2 : 1;
    count += 1;
  }
  return count;
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

type SmoothStreamingOptions = {
  active?: boolean;
  streamKey?: string;
};

/**
 * Smooths arbitrary provider chunks into one lossless display stream.
 *
 * The source remains authoritative. We only delay an append-only suffix; edits,
 * retries, stream changes, reduced-motion mode, and completion are committed
 * immediately. A fractional frame budget prevents fast providers from dumping
 * whole chunks while still allowing a large backlog to catch up quickly.
 */
export function useSmoothStreamingText(
  source: string,
  { active = true, streamKey = "stream" }: SmoothStreamingOptions = {},
): string {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = active && !reducedMotion;
  const [visibleText, setVisibleText] = useState(source);
  const sourceRef = useRef(source);
  const visibleRef = useRef(source);
  const activeRef = useRef(shouldAnimate);
  const streamKeyRef = useRef(streamKey);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const graphemeCreditRef = useRef(0);

  sourceRef.current = source;
  activeRef.current = shouldAnimate;

  const cancelFrame = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastFrameTimeRef.current = 0;
    graphemeCreditRef.current = 0;
  };

  const commit = (next: string) => {
    if (visibleRef.current === next) return;
    visibleRef.current = next;
    setVisibleText(next);
  };

  const scheduleFrame = () => {
    if (frameRef.current !== null) return;

    const paint = (now: number) => {
      frameRef.current = null;
      const target = sourceRef.current;
      const displayed = visibleRef.current;

      if (!activeRef.current || !target.startsWith(displayed)) {
        cancelFrame();
        commit(target);
        return;
      }

      if (displayed === target) {
        lastFrameTimeRef.current = 0;
        graphemeCreditRef.current = 0;
        return;
      }

      const elapsedMs = lastFrameTimeRef.current
        ? clamp(now - lastFrameTimeRef.current, 1, 64)
        : 16;
      lastFrameTimeRef.current = now;

      // Once the backlog reaches the maximum paint window its exact size no
      // longer changes the rate. Cap segmentation work so huge chunks stay O(1)
      // per frame instead of repeatedly scanning the entire remaining answer.
      const backlog = countGraphemesUpTo(
        target,
        displayed.length,
        MAX_GRAPHEMES_PER_FRAME * 2,
      );
      const rate = clamp(
        backlog / TARGET_BACKLOG_SECONDS,
        MIN_GRAPHEMES_PER_SECOND,
        MAX_GRAPHEMES_PER_SECOND,
      );
      graphemeCreditRef.current += (rate * elapsedMs) / 1000;

      const graphemesToPaint = Math.min(
        MAX_GRAPHEMES_PER_FRAME,
        backlog,
        Math.floor(graphemeCreditRef.current),
      );

      if (graphemesToPaint > 0) {
        graphemeCreditRef.current -= graphemesToPaint;
        const end = advanceGraphemes(
          target,
          displayed.length,
          graphemesToPaint,
        );
        commit(target.slice(0, end));
      }

      if (visibleRef.current !== sourceRef.current) {
        frameRef.current = requestAnimationFrame(paint);
      }
    };

    frameRef.current = requestAnimationFrame(paint);
  };

  useLayoutEffect(() => {
    const streamChanged = streamKeyRef.current !== streamKey;
    if (streamChanged) {
      streamKeyRef.current = streamKey;
      cancelFrame();
      commit(source);
      return;
    }

    if (!shouldAnimate) {
      cancelFrame();
      commit(source);
      return;
    }

    const displayed = visibleRef.current;
    if (!source.startsWith(displayed)) {
      cancelFrame();
      commit(source);
      return;
    }

    if (source.length > displayed.length) scheduleFrame();
  }, [shouldAnimate, source, streamKey]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return shouldAnimate ? visibleText : source;
}
