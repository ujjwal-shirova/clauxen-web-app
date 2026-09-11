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

/**
 * Hysteresis band for the pinned (auto-follow) state. A single threshold
 * flaps when the viewport hovers right at the boundary — follow starts and
 * stops every other scroll event, which reads as stutter. Two thresholds fix
 * that: the user must scroll clearly away to unpin, and clearly back to
 * re-pin.
 */
/** At or below this distance from bottom (px) we engage auto-follow. */
const PIN_THRESHOLD_PX = 64;
/** Past this distance from bottom (px) we release auto-follow. */
const UNPIN_THRESHOLD_PX = 160;
/** Distance from bottom (px) past which the scroll-to-bottom affordance shows. */
const SHOW_BUTTON_THRESHOLD_PX = 240;
/** Bounds for the explicit scroll-to-latest animation. */
const SMOOTH_SCROLL_MIN_MS = 280;
const SMOOTH_SCROLL_MAX_MS = 560;
/** px per ms used to scale animation duration with travel distance. */
const SMOOTH_SCROLL_PX_PER_MS = 4.5;

function maxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

function distanceFromBottom(viewport: HTMLElement) {
  return maxScrollTop(viewport) - viewport.scrollTop;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Owns chat scroll behavior with a single source of truth:
 * - follows streaming output only while the viewport is pinned near the bottom
 * - unpins the instant the user scrolls upward — no cooldown, no fight
 * - re-pins when the user scrolls back down near the bottom
 * - never programmatically scrolls while unpinned
 * - the explicit scroll-to-latest affordance runs one cancellable animation
 */
export function useChatScroll({ scrollAreaRef, enabled }: UseChatScrollOptions) {
  const viewportRef = useRef<HTMLElement | null>(null);
  const pinnedRef = useRef(true);
  const smoothRafRef = useRef<number | null>(null);
  const showScrollToBottomRef = useRef(false);
  const lastTouchYRef = useRef<number | null>(null);
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

  const cancelSmoothScroll = useCallback(() => {
    if (smoothRafRef.current !== null) {
      cancelAnimationFrame(smoothRafRef.current);
      smoothRafRef.current = null;
    }
  }, []);

  const syncButtonVisibility = useCallback((distance: number) => {
    const shouldShow = distance > SHOW_BUTTON_THRESHOLD_PX;
    if (showScrollToBottomRef.current !== shouldShow) {
      showScrollToBottomRef.current = shouldShow;
      setShowScrollToBottom(shouldShow);
    }
  }, []);

  /**
   * Synchronous pin decision — cheap enough to run on every scroll event.
   * Batching this behind rAF lets one programmatic follow write land after
   * the user already started scrolling, which reads as a fight/jump.
   */
  const syncPinnedFromViewport = useCallback(
    (viewport: HTMLElement) => {
      const distance = distanceFromBottom(viewport);
      if (pinnedRef.current) {
        if (distance > UNPIN_THRESHOLD_PX) pinnedRef.current = false;
      } else if (distance <= PIN_THRESHOLD_PX) {
        pinnedRef.current = true;
      }
      syncButtonVisibility(distance);
    },
    [syncButtonVisibility],
  );

  /** Stick to the bottom instantly. Content only ever grows at the end while
   * pinned, so the correct follow is exactly one synchronous correction per
   * growth tick — easing toward it lags behind fast token bursts and replays
   * every code-block mount as a visible chase. */
  const stickToBottom = useCallback(() => {
    const viewport = resolveViewport();
    if (!viewport || !pinnedRef.current) return;
    const top = maxScrollTop(viewport);
    if (viewport.scrollTop !== top) viewport.scrollTop = top;
    syncButtonVisibility(0);
  }, [resolveViewport, syncButtonVisibility]);

  /** Public: force-pin without animation (e.g. on send / chat switch). */
  const pinToBottom = useCallback(() => {
    cancelSmoothScroll();
    pinnedRef.current = true;
    syncButtonVisibility(0);
    const viewport = resolveViewport();
    if (!viewport) return;
    viewport.scrollTop = maxScrollTop(viewport);
  }, [cancelSmoothScroll, resolveViewport, syncButtonVisibility]);

  /** Public: explicit user request to return to latest (button). One
   * time-based animation that tracks a moving bottom while streaming, so it
   * always lands pinned even when output is still growing. */
  const scrollToBottom = useCallback(() => {
    const viewport = resolveViewport();
    if (!viewport) return;
    cancelSmoothScroll();

    const startTop = viewport.scrollTop;
    const startDistance = distanceFromBottom(viewport);
    if (startDistance <= 1) {
      pinnedRef.current = true;
      syncButtonVisibility(0);
      return;
    }

    // Stay unpinned during the flight: if the user interrupts mid-way, the
    // interrupted position — not a stale pin — owns follow state.
    pinnedRef.current = false;
    const duration = Math.min(
      SMOOTH_SCROLL_MAX_MS,
      Math.max(
        SMOOTH_SCROLL_MIN_MS,
        startDistance / SMOOTH_SCROLL_PX_PER_MS,
      ),
    );
    const startTime = performance.now();

    const step = (now: number) => {
      smoothRafRef.current = null;
      const current = resolveViewport();
      if (!current) return;
      const elapsed = now - startTime;
      const target = maxScrollTop(current);
      const t = Math.min(1, elapsed / duration);
      current.scrollTop = startTop + (target - startTop) * easeOutCubic(t);
      syncButtonVisibility(distanceFromBottom(current));
      if (t < 1) {
        smoothRafRef.current = requestAnimationFrame(step);
        return;
      }
      // Landed: target may have moved on the final frame while streaming.
      current.scrollTop = maxScrollTop(current);
      pinnedRef.current = true;
      syncButtonVisibility(0);
    };
    smoothRafRef.current = requestAnimationFrame(step);
  }, [cancelSmoothScroll, resolveViewport, syncButtonVisibility]);

  useEffect(() => {
    if (!enabled) {
      cancelSmoothScroll();
      pinnedRef.current = true;
      viewportRef.current = null;
      syncButtonVisibility(0);
      return;
    }
    const viewport = resolveViewport();
    if (!viewport) return;

    const content =
      (viewport.firstElementChild as HTMLElement | null) ?? viewport;

    const handleScroll = () => {
      // Our own smooth animation owns every frame — scroll events it emits
      // must not flip pin state mid-flight.
      if (smoothRafRef.current !== null) return;
      syncPinnedFromViewport(viewport);
    };

    const handleUserWheel = (event: WheelEvent) => {
      const intent = resolveWheelIntent(event);
      // Horizontal gestures inside code/table blocks must not affect vertical
      // stream-follow state.
      if (!intent || intent.axis !== "y") return;
      // Any vertical gesture hands control back to the user immediately.
      cancelSmoothScroll();
      // Scrolling upward is an explicit request to read earlier content. Unpin
      // synchronously — waiting for the scroll event lets one follow write
      // land first and visibly fight the gesture.
      if (intent.delta < 0) pinnedRef.current = false;
      // Downward motion re-pins via the scroll handler once it actually
      // arrives near the bottom — never speculatively.
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY;
      const lastY = lastTouchYRef.current;
      if (currentY === undefined) return;
      cancelSmoothScroll();
      // Finger moving down scrolls the transcript up → release follow.
      if (lastY !== null && currentY > lastY + 2) pinnedRef.current = false;
      lastTouchYRef.current = currentY;
    };

    const handleTouchEnd = () => {
      lastTouchYRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
        case "PageUp":
        case "Home":
          cancelSmoothScroll();
          pinnedRef.current = false;
          break;
        case "ArrowDown":
        case "PageDown":
        case "End":
        case " ":
          // Downward keys hand control back; re-pin happens on arrival.
          cancelSmoothScroll();
          break;
        default:
          break;
      }
    };

    // Scrollbar drags take over mid-animation; pin state follows from the
    // resulting scroll position.
    const handlePointerDown = () => cancelSmoothScroll();

    const resizeObserver = new ResizeObserver(() => {
      const current = resolveViewport();
      if (!current) return;

      // Agent fold expand/collapse locks the header position; do not follow
      // or the user bubble jumps upward while the panel opens.
      if (isChatScrollAnchorLockActive()) return;

      // Never rewrite scrollTop while the user is reading earlier content.
      if (!pinnedRef.current) return;

      stickToBottom();
    });
    // Content growth (streaming tokens, mounted blocks, composer spacer) and
    // viewport resizes (window, side rails) both move the bottom while pinned.
    resizeObserver.observe(content);
    if (content !== viewport) resizeObserver.observe(viewport);

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    // Capture phase so nested tool/thinking overflow scrollers still release
    // stream-follow when the user wheels away from the bottom.
    viewport.addEventListener("wheel", handleUserWheel, {
      passive: true,
      capture: true,
    });
    viewport.addEventListener("touchstart", handleTouchStart, {
      passive: true,
      capture: true,
    });
    viewport.addEventListener("touchmove", handleTouchMove, {
      passive: true,
      capture: true,
    });
    viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    viewport.addEventListener("keydown", handleKeyDown);
    viewport.addEventListener("pointerdown", handlePointerDown);

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", handleUserWheel, true);
      viewport.removeEventListener("touchstart", handleTouchStart, true);
      viewport.removeEventListener("touchmove", handleTouchMove, true);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
      viewport.removeEventListener("keydown", handleKeyDown);
      viewport.removeEventListener("pointerdown", handlePointerDown);
      cancelSmoothScroll();
    };
  }, [
    enabled,
    resolveViewport,
    stickToBottom,
    cancelSmoothScroll,
    syncPinnedFromViewport,
    syncButtonVisibility,
  ]);

  return {
    scrollToBottom,
    pinToBottom,
    showScrollToBottom,
  };
}
