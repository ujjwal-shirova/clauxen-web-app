"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isChatScrollAnchorLockActive } from "@/lib/chat-scroll-anchor";
import { resolveWheelIntent } from "@/lib/nested-scroll";

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
const USER_INPUT_COOLDOWN_MS = 480;
/** Per-frame easing keeps growing output continuous instead of hard-snapping. */
const FOLLOW_EASE = 0.28;
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

  const cancelFollow = useCallback(() => {
    if (followRafRef.current !== null) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
  }, []);

  const syncPinnedFromViewport = useCallback(
    (viewport: HTMLElement) => {
      const distance = distanceFromBottom(viewport);
      const isPinned = distance <= REPIN_THRESHOLD;
      const wasPinned = pinnedRef.current;
      pinnedRef.current = isPinned;
      if (wasPinned && !isPinned) {
        cancelFollow();
      }
      const shouldShow = distance > SHOW_BUTTON_THRESHOLD;
      if (showScrollToBottomRef.current !== shouldShow) {
        showScrollToBottomRef.current = shouldShow;
        setShowScrollToBottom(shouldShow);
      }
      return isPinned;
    },
    [cancelFollow],
  );

  const markUserInput = useCallback(() => {
    userInputUntilRef.current = performance.now() + USER_INPUT_COOLDOWN_MS;
    // A real gesture must win over a just-issued programmatic follow scroll.
    programmaticScrollUntilRef.current = 0;
    cancelFollow();

  }, [cancelFollow]);

  const handleUserWheel = useCallback(
    (event: WheelEvent) => {
      const intent = resolveWheelIntent(event);
      // Horizontal gestures inside code/table blocks must not affect vertical
      // stream-follow state.
      if (!intent || intent.axis !== "y") return;

      markUserInput();
      // Scrolling upward is an explicit request to read earlier content. Unpin
      // immediately even when the gesture begins inside the 96px repin zone;
      // otherwise auto-follow resumes after the cooldown and fights the user.
      if (intent.delta < 0) {
        pinnedRef.current = false;
      }
    },
    [markUserInput],
  );

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

        if (
          !isUserInputActive() &&
          performance.now() < programmaticScrollUntilRef.current
        ) {
          lastScrollHeightRef.current = viewport.scrollHeight;
          return;
        }
        syncPinnedFromViewport(viewport);
        lastScrollHeightRef.current = viewport.scrollHeight;
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

      // Agent fold expand/collapse locks the header position; do not pin-follow
      // or the user bubble jumps upward while the panel opens.
      if (isChatScrollAnchorLockActive()) {
        return;
      }

      // Never rewrite scrollTop while the user is reading earlier content.
      // Most stream growth happens below the viewport, so preserving the old
      // distance-from-bottom visibly moved the current line by every height
      // delta. Explicit expand/collapse operations own their local anchor.
      if (!pinnedRef.current) {
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
    viewport.addEventListener("wheel", handleUserWheel, {
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
      viewport.removeEventListener("wheel", handleUserWheel, true);
      viewport.removeEventListener("touchstart", markUserInput, true);
      viewport.removeEventListener("touchmove", markUserInput, true);
      cancelFollow();
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
    handleUserWheel,
    markProgrammaticScroll,
    isUserInputActive,
    syncPinnedFromViewport,
    cancelFollow,
  ]);

  return {
    scrollToBottom,
    pinToBottom,
    showScrollToBottom,
  };
}
