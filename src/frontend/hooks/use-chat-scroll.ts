"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseChatScrollOptions = {
  /** Radix ScrollArea root ref (we resolve the viewport from it). */
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  /** Whether a conversation is mounted (listeners only attach when true). */
  enabled: boolean;
};

/** Distance from bottom (px) under which we consider the user "pinned". */
const REPIN_THRESHOLD = 96;
/** Distance from bottom (px) under which resize-driven follow is allowed. */
const FOLLOW_THRESHOLD = 48;
/** Distance from bottom (px) past which the scroll-to-bottom affordance shows. */
const SHOW_BUTTON_THRESHOLD = 220;
/** Ignore auto-follow briefly after explicit user wheel/touch input. */
const USER_INPUT_COOLDOWN_MS = 180;
/** Instant snap while following — matches create_file container scrollTop = scrollHeight. */
const FOLLOW_EASE = 1;
/** Below this distance we snap exactly to bottom instead of easing forever. */
const FOLLOW_SNAP_EPSILON_PX = 0.5;

function maxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

function distanceFromBottom(viewport: HTMLElement) {
  return maxScrollTop(viewport) - viewport.scrollTop;
}

/**
 * Move partway toward the bottom instead of snapping instantly. Content that
 * grows every frame (fast token bursts, a code block resolving, a tool panel
 * collapsing) would otherwise re-snap to a new max every frame, which reads
 * as a jittery "hard cut" rather than a continuous scroll.
 * Returns true once the viewport has fully caught up.
 * ponytail: the ease factor is per-frame, not delta-time-based, so a dropped
 * frame slows the catch-up slightly instead of skipping ahead. Fine at
 * typical 60fps; if this ever needs to be frame-rate independent, drive it
 * off performance.now() deltas instead.
 */
function easeTowardBottom(
  viewport: HTMLElement,
  beforeScroll?: () => void,
): boolean {
  const distance = distanceFromBottom(viewport);
  if (distance <= FOLLOW_SNAP_EPSILON_PX) {
    if (distance !== 0) {
      beforeScroll?.();
      viewport.scrollTop = maxScrollTop(viewport);
    }
    return true;
  }
  beforeScroll?.();
  viewport.scrollTop += distance * FOLLOW_EASE;
  return false;
}

/**
 * Owns chat scroll behavior with a single source of truth:
 * - follows streaming output only while the viewport is near the bottom
 * - unpins as soon as the user scrolls away from the bottom
 * - re-pins when the user returns near the bottom
 * - never programmatically scrolls while unpinned
 * - pauses follow entirely while older history is prepending (no flicker)
 */
export function useChatScroll({ scrollAreaRef, enabled }: UseChatScrollOptions) {
  const viewportRef = useRef<HTMLElement | null>(null);
  const pinnedRef = useRef(true);
  const followRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const showScrollToBottomRef = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const userInputUntilRef = useRef(0);
  const programmaticScrollUntilRef = useRef(0);
  /** >0 while IntersectionObserver-driven older-page loads are in flight. */
  const historyLoadDepthRef = useRef(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const resolveViewport = useCallback((): HTMLElement | null => {
    if (viewportRef.current && viewportRef.current.isConnected) {
      return viewportRef.current;
    }
    const root = scrollAreaRef.current;
    if (!root) return null;
    const viewport = root.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    viewportRef.current = viewport;
    return viewport;
  }, [scrollAreaRef]);

  const isHistoryLoading = useCallback(
    () => historyLoadDepthRef.current > 0,
    [],
  );

  const setHistoryLoading = useCallback((loading: boolean) => {
    if (loading) {
      historyLoadDepthRef.current += 1;
      if (followRafRef.current !== null) {
        cancelAnimationFrame(followRafRef.current);
        followRafRef.current = null;
      }
      return;
    }
    historyLoadDepthRef.current = Math.max(0, historyLoadDepthRef.current - 1);
  }, []);

  const markUserInput = useCallback(() => {
    userInputUntilRef.current = performance.now() + USER_INPUT_COOLDOWN_MS;
  }, []);

  const isUserInputActive = useCallback(() => {
    return performance.now() < userInputUntilRef.current;
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollUntilRef.current = performance.now() + 120;
  }, []);

  /** Snap to bottom when pinned — same instant behavior as create_file stream scroll. */
  const stickToBottomWhenPinned = useCallback(
    (viewport: HTMLElement) => {
      if (isHistoryLoading()) return;
      if (!pinnedRef.current || isUserInputActive()) return;
      if (distanceFromBottom(viewport) > FOLLOW_THRESHOLD) {
        markProgrammaticScroll();
        viewport.scrollTop = maxScrollTop(viewport);
        lastScrollHeightRef.current = viewport.scrollHeight;
        return;
      }

      markProgrammaticScroll();
      viewport.scrollTop = maxScrollTop(viewport);
      lastScrollHeightRef.current = viewport.scrollHeight;
    },
    [isHistoryLoading, isUserInputActive, markProgrammaticScroll],
  );

  /** Keep chasing the bottom across frames until caught up, not just one snap. */
  const scheduleStickToBottom = useCallback(() => {
    if (followRafRef.current !== null) return;
    const step = () => {
      const viewport = resolveViewport();
      if (
        !viewport ||
        !pinnedRef.current ||
        isUserInputActive() ||
        isHistoryLoading()
      ) {
        followRafRef.current = null;
        return;
      }
      markProgrammaticScroll();
      viewport.scrollTop = maxScrollTop(viewport);
      lastScrollHeightRef.current = viewport.scrollHeight;
      if (distanceFromBottom(viewport) > FOLLOW_SNAP_EPSILON_PX) {
        followRafRef.current = requestAnimationFrame(step);
        return;
      }
      followRafRef.current = null;
    };
    followRafRef.current = requestAnimationFrame(step);
  }, [
    resolveViewport,
    isUserInputActive,
    isHistoryLoading,
    markProgrammaticScroll,
  ]);

  const jumpToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = resolveViewport();
      if (!viewport) return;
      pinnedRef.current = true;
      userInputUntilRef.current = 0;
      const top = maxScrollTop(viewport);
      markProgrammaticScroll();
      if (behavior === "smooth") {
        viewport.scrollTo({ top, behavior: "smooth" });
      } else {
        viewport.scrollTop = top;
      }
      lastScrollHeightRef.current = viewport.scrollHeight;
      showScrollToBottomRef.current = false;
      setShowScrollToBottom(false);
    },
    [resolveViewport, markProgrammaticScroll],
  );

  /** Public: explicit user request to return to bottom (button / send). */
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      jumpToBottom(behavior);
    },
    [jumpToBottom],
  );

  /** Public: force-pin without animation (e.g. on send / chat switch). */
  const pinToBottom = useCallback(() => {
    jumpToBottom("auto");
  }, [jumpToBottom]);

  /** Ease toward bottom while pinned during streaming / content growth. */
  const followContentGrowth = useCallback(() => {
    const viewport = resolveViewport();
    if (!viewport) return;
    if (isHistoryLoading()) return;
    if (!pinnedRef.current || isUserInputActive()) return;

    easeTowardBottom(viewport, markProgrammaticScroll);
    lastScrollHeightRef.current = viewport.scrollHeight;
  }, [
    resolveViewport,
    isHistoryLoading,
    isUserInputActive,
    markProgrammaticScroll,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const viewport = resolveViewport();
    if (!viewport) return;

    const content =
      (viewport.firstElementChild as HTMLElement | null) ?? viewport;

    lastScrollHeightRef.current = viewport.scrollHeight;

    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;

        const distance = distanceFromBottom(viewport);
        if (performance.now() < programmaticScrollUntilRef.current) {
          lastScrollHeightRef.current = viewport.scrollHeight;
          return;
        }
        const wasPinned = pinnedRef.current;
        const isPinned = distance <= REPIN_THRESHOLD;
        pinnedRef.current = isPinned;
        lastScrollHeightRef.current = viewport.scrollHeight;

        if (wasPinned && !isPinned && followRafRef.current !== null) {
          cancelAnimationFrame(followRafRef.current);
          followRafRef.current = null;
        }

        const shouldShow = distance > SHOW_BUTTON_THRESHOLD;
        if (showScrollToBottomRef.current !== shouldShow) {
          showScrollToBottomRef.current = shouldShow;
          setShowScrollToBottom(shouldShow);
        }
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      const viewport = resolveViewport();
      if (!viewport) return;
      if (isHistoryLoading()) {
        lastScrollHeightRef.current = viewport.scrollHeight;
        return;
      }

      const nextScrollHeight = viewport.scrollHeight;
      const prevScrollHeight = lastScrollHeightRef.current;
      lastScrollHeightRef.current = nextScrollHeight;

      if (pinnedRef.current && nextScrollHeight !== prevScrollHeight) {
        scheduleStickToBottom();
      }
    });
    resizeObserver.observe(content);

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("wheel", markUserInput, { passive: true });
    viewport.addEventListener("touchstart", markUserInput, { passive: true });
    viewport.addEventListener("touchmove", markUserInput, { passive: true });

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", markUserInput);
      viewport.removeEventListener("touchstart", markUserInput);
      viewport.removeEventListener("touchmove", markUserInput);
      if (followRafRef.current !== null) {
        cancelAnimationFrame(followRafRef.current);
        followRafRef.current = null;
      }
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [
    enabled,
    resolveViewport,
    scheduleStickToBottom,
    markUserInput,
    isHistoryLoading,
  ]);

  return {
    scrollToBottom,
    pinToBottom,
    showScrollToBottom,
    followContentGrowth,
    setHistoryLoading,
  };
}
