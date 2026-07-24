"use client";

import { useEffect, useRef, useState } from "react";

type ScrollPhase = {
  isScrolling: boolean;
  isFastScrolling: boolean;
};

const SCROLL_END_MS = 120;
/** px/ms — above this we treat the gesture as fast scroll. */
const FAST_SCROLL_VELOCITY = 1.15;

function resolveChatViewport(
  scrollAreaRef: React.RefObject<HTMLDivElement | null>,
): HTMLElement | null {
  const root = scrollAreaRef.current;
  if (!root) return null;
  return (
    root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? root
  );
}

/**
 * Tracks scroll activity without waking React on every scroll event.
 * State updates only when scrolling / fast-scroll phase changes.
 */
export function useChatScrollActivity(
  scrollAreaRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const phaseRef = useRef<ScrollPhase>({
    isScrolling: false,
    isFastScrolling: false,
  });
  const [phase, setPhase] = useState<ScrollPhase>(phaseRef.current);
  const onScrollEndRef = useRef<(() => void) | null>(null);

  const registerScrollEnd = (fn: (() => void) | null) => {
    onScrollEndRef.current = fn;
  };

  useEffect(() => {
    if (!enabled) return;

    const viewport = resolveChatViewport(scrollAreaRef);
    if (!viewport) return;

    let endTimer = 0;
    let lastTop = viewport.scrollTop;
    let lastTime = performance.now();
    let phaseRaf = 0;

    const commitPhase = (next: ScrollPhase) => {
      const prev = phaseRef.current;
      if (
        prev.isScrolling === next.isScrolling &&
        prev.isFastScrolling === next.isFastScrolling
      ) {
        return;
      }
      phaseRef.current = next;
      setPhase(next);
      if (!next.isScrolling) {
        onScrollEndRef.current?.();
      }
    };

    const schedulePhaseCommit = (next: ScrollPhase) => {
      phaseRef.current = next;
      if (phaseRaf !== 0) return;
      phaseRaf = requestAnimationFrame(() => {
        phaseRaf = 0;
        commitPhase(phaseRef.current);
      });
    };

    const onScroll = () => {
      const now = performance.now();
      const top = viewport.scrollTop;
      const dt = Math.max(now - lastTime, 1);
      const velocity = Math.abs(top - lastTop) / dt;
      lastTop = top;
      lastTime = now;

      schedulePhaseCommit({
        isScrolling: true,
        isFastScrolling: velocity >= FAST_SCROLL_VELOCITY,
      });

      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => {
        commitPhase({ isScrolling: false, isFastScrolling: false });
      }, SCROLL_END_MS);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", onScroll);
      window.clearTimeout(endTimer);
      if (phaseRaf !== 0) {
        cancelAnimationFrame(phaseRaf);
      }
    };
  }, [enabled, scrollAreaRef]);

  return {
    isScrolling: phase.isScrolling,
    isFastScrolling: phase.isFastScrolling,
    phaseRef,
    registerScrollEnd,
  };
}
