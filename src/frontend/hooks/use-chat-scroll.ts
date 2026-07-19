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
/** Distance from bottom (px) past which the scroll-to-bottom affordance shows. */
const SHOW_BUTTON_THRESHOLD = 220;
/** Ignore auto-follow briefly after explicit user wheel/touch input. */
const USER_INPUT_COOLDOWN_MS = 260;
/** Per-frame easing keeps growing output continuous instead of hard-snapping. */
const FOLLOW_EASE = 0.24;
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
    }
    viewport.scrollTop = maxScrollTop(viewport);
    return true;
  }
  beforeScroll?.();
  viewport.scrollTop += Math.min(
    distance,
    Math.max(1, distance * FOLLOW_EASE),
  );
  return false;
}

/**
 * Owns chat scroll behavior with a single source of truth:
 * - follows streaming output only while the viewport is near the bottom
 * - unpins as soon as the user scrolls away from the bottom
 * - re-pins when the user returns near the bottom
 * - never programmatically scrolls while unpinned
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

  const markUserInput = useCallback(() => {
    userInputUntilRef.current = performance.now() + USER_INPUT_COOLDOWN_MS;
    // A real gesture must win over a just-issued programmatic follow scroll.
    programmaticScrollUntilRef.current = 0;
    if (followRafRef.current !== null) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
  }, []);

  const isUserInputActive = useCallback(() => {
    return performance.now() < userInputUntilRef.current;
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollUntilRef.current = performance.now() + 80;
  }, []);

  /** Keep chasing the bottom across frames until caught up, not just one snap. */
  const scheduleStickToBottom = useCallback(() => {
    if (followRafRef.current !== null) return;
    const step = () => {
      const viewport = resolveViewport();
      if (!viewport || !pinnedRef.current || isUserInputActive()) {
        followRafRef.current = null;
        return;
      }
      markProgrammaticScroll();
      const caughtUp = easeTowardBottom(viewport);
      lastScrollHeightRef.current = viewport.scrollHeight;
      if (!caughtUp) {
        followRafRef.current = requestAnimationFrame(step);
        return;
      }
      followRafRef.current = null;
    };
    followRafRef.current = requestAnimationFrame(step);
  }, [resolveViewport, isUserInputActive, markProgrammaticScroll]);

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
    if (!pinnedRef.current || isUserInputActive()) return;

    easeTowardBottom(viewport, markProgrammaticScroll);
    lastScrollHeightRef.current = viewport.scrollHeight;
  }, [resolveViewport, isUserInputActive, markProgrammaticScroll]);

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
        if (
          !isUserInputActive() &&
          performance.now() < programmaticScrollUntilRef.current
        ) {
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

      const nextScrollHeight = viewport.scrollHeight;
      const prevScrollHeight = lastScrollHeightRef.current;
      const heightDelta = nextScrollHeight - prevScrollHeight;
      lastScrollHeightRef.current = nextScrollHeight;

      if (heightDelta === 0) return;

      // While the user is reading earlier content, collapsing chrome above
      // (fold headers / tool cards) would yank the viewport toward the top of
      // the assistant. Preserve distance-from-bottom so the same lines stay put.
      if (!pinnedRef.current && heightDelta < 0 && !isUserInputActive()) {
        const distance = Math.max(
          0,
          prevScrollHeight - viewport.clientHeight - viewport.scrollTop,
        );
        const nextTop = Math.max(
          0,
          nextScrollHeight - viewport.clientHeight - distance,
        );
        if (Math.abs(nextTop - viewport.scrollTop) > 0.5) {
          markProgrammaticScroll();
          viewport.scrollTop = nextTop;
        }
        return;
      }

      if (pinnedRef.current) {
        scheduleStickToBottom();
      }
    });
    resizeObserver.observe(content);

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    // Capture phase so nested tool/thinking overflow scrollers still unpin
    // stream-follow when the user wheels away from the bottom.
    viewport.addEventListener("wheel", markUserInput, {
      passive: true,
      capture: true,
    });
    viewport.addEventListener("touchstart", markUserInput, {
      passive: true,
      capture: true,
    });
    viewport.addEventListener("touchmove", markUserInput, {
      passive: true,
      capture: true,
    });

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", markUserInput, true);
      viewport.removeEventListener("touchstart", markUserInput, true);
      viewport.removeEventListener("touchmove", markUserInput, true);
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
    markProgrammaticScroll,
    isUserInputActive,
  ]);

  return {
    scrollToBottom,
    pinToBottom,
    showScrollToBottom,
    followContentGrowth,
  };
}
