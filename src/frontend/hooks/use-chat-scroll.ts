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

function maxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

function distanceFromBottom(viewport: HTMLElement) {
  return maxScrollTop(viewport) - viewport.scrollTop;
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
  }, []);

  const isUserInputActive = useCallback(() => {
    return performance.now() < userInputUntilRef.current;
  }, []);

  /** Snap to bottom when pinned — avoids delta-scroll jumps during markdown reflow. */
  const stickToBottomWhenPinned = useCallback(
    (viewport: HTMLElement) => {
      if (!pinnedRef.current || isUserInputActive()) return;

      const maxTop = maxScrollTop(viewport);
      const distance = maxTop - viewport.scrollTop;
      if (distance > FOLLOW_THRESHOLD) return;

      if (distance !== 0) {
        viewport.scrollTop = maxTop;
      }
      lastScrollHeightRef.current = viewport.scrollHeight;
    },
    [isUserInputActive],
  );

  const scheduleStickToBottom = useCallback(() => {
    if (followRafRef.current !== null) return;
    followRafRef.current = requestAnimationFrame(() => {
      followRafRef.current = null;
      const viewport = resolveViewport();
      if (viewport) stickToBottomWhenPinned(viewport);
    });
  }, [resolveViewport, stickToBottomWhenPinned]);

  const jumpToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = resolveViewport();
      if (!viewport) return;
      pinnedRef.current = true;
      userInputUntilRef.current = 0;
      const top = maxScrollTop(viewport);
      if (behavior === "smooth") {
        viewport.scrollTo({ top, behavior: "smooth" });
      } else {
        viewport.scrollTop = top;
      }
      lastScrollHeightRef.current = viewport.scrollHeight;
      showScrollToBottomRef.current = false;
      setShowScrollToBottom(false);
    },
    [resolveViewport],
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

  /** Snap to bottom while pinned during streaming / content growth. */
  const followContentGrowth = useCallback(() => {
    const viewport = resolveViewport();
    if (!viewport) return;
    if (!pinnedRef.current || isUserInputActive()) return;

    const maxTop = maxScrollTop(viewport);
    if (viewport.scrollTop !== maxTop) {
      viewport.scrollTop = maxTop;
    }
    lastScrollHeightRef.current = viewport.scrollHeight;
  }, [resolveViewport, isUserInputActive]);

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
  }, [enabled, resolveViewport, scheduleStickToBottom, markUserInput]);

  return { scrollToBottom, pinToBottom, showScrollToBottom, followContentGrowth };
}
