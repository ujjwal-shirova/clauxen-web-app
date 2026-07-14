"use client";

import { useEffect, useRef } from "react";

type UseLoadOlderOnScrollOptions = {
  /** Radix ScrollArea viewport (or any overflow scroll root). */
  getViewport: () => HTMLElement | null;
  /** Top-of-thread sentinel element. */
  sentinelRef: React.RefObject<HTMLElement | null>;
  hasMore: boolean;
  isLoading: boolean;
  enabled?: boolean;
  /**
   * Called when the top sentinel enters the viewport.
   * Should resolve after messages are prepended so scroll can be restored.
   */
  onLoadOlder: () => Promise<boolean>;
  /** Pause stick-to-bottom / streaming follow while history is loading. */
  onHistoryLoadChange?: (loading: boolean) => void;
  /**
   * Snapshot before fetch so the caller can restore scroll after prepend.
   * Called synchronously right before `onLoadOlder`.
   */
  onBeforeLoad?: (viewport: HTMLElement) => void;
};

/**
 * ChatGPT / Claude-style older-history loader:
 * IntersectionObserver on a top sentinel (not scrollTop heuristics).
 *
 * Why this beats scrollTop + userScrolledUp:
 * - Short threads (few messages) can't scroll, so scrollTop never drops —
 *   but the sentinel is still visible → we keep loading until overflow or EOF.
 * - Stick-to-bottom / streaming rAF no longer need to "accidentally" move
 *   scrollTop to unlock pagination.
 */
export function useLoadOlderOnScroll({
  getViewport,
  sentinelRef,
  hasMore,
  isLoading,
  enabled = true,
  onLoadOlder,
  onHistoryLoadChange,
  onBeforeLoad,
}: UseLoadOlderOnScrollOptions) {
  const inFlightRef = useRef(false);
  const isLoadingRef = useRef(isLoading);
  const hasMoreRef = useRef(hasMore);
  const onLoadOlderRef = useRef(onLoadOlder);
  const onHistoryLoadChangeRef = useRef(onHistoryLoadChange);
  const onBeforeLoadRef = useRef(onBeforeLoad);
  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;
  onLoadOlderRef.current = onLoadOlder;
  onHistoryLoadChangeRef.current = onHistoryLoadChange;
  onBeforeLoadRef.current = onBeforeLoad;

  useEffect(() => {
    if (!enabled) return;

    const viewport = getViewport();
    const sentinel = sentinelRef.current;
    if (!viewport || !sentinel) return;

    let cancelled = false;

    const runLoad = () => {
      if (cancelled || inFlightRef.current) return;
      if (!hasMoreRef.current || isLoadingRef.current) return;
      inFlightRef.current = true;
      onBeforeLoadRef.current?.(viewport);
      onHistoryLoadChangeRef.current?.(true);
      void onLoadOlderRef
        .current()
        .catch(() => false)
        .finally(() => {
          inFlightRef.current = false;
          if (!cancelled) {
            onHistoryLoadChangeRef.current?.(false);
          }
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        runLoad();
      },
      {
        root: viewport,
        // Start fetching before the user hits the absolute top.
        rootMargin: "320px 0px 0px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    // Short threads: sentinel is already in view on mount — kick a load.
    // rAF lets layout settle after pin-to-bottom.
    const boot = requestAnimationFrame(() => {
      if (!hasMoreRef.current) return;
      const rect = sentinel.getBoundingClientRect();
      const rootRect = viewport.getBoundingClientRect();
      const visible =
        rect.bottom >= rootRect.top - 320 && rect.top <= rootRect.bottom;
      if (visible) runLoad();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
      observer.disconnect();
      // Do not call onHistoryLoadChange(false) here — an in-flight load's
      // finally still owns the pause counter. Clearing it in cleanup caused
      // stick-to-bottom to resume mid-prepend (assistant flicker).
    };
  }, [enabled, getViewport, sentinelRef]);

  // When a load finishes and the sentinel is still visible (short thread /
  // user parked at top), chain the next page without waiting for a scroll.
  useEffect(() => {
    if (!enabled || !hasMore || isLoading || inFlightRef.current) return;
    const viewport = getViewport();
    const sentinel = sentinelRef.current;
    if (!viewport || !sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    const rootRect = viewport.getBoundingClientRect();
    const visible =
      rect.bottom >= rootRect.top - 320 && rect.top <= rootRect.bottom;
    if (!visible) return;
    // Defer so prepend scroll restoration can run first.
    const t = window.setTimeout(() => {
      if (!hasMoreRef.current || isLoadingRef.current || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      onBeforeLoadRef.current?.(viewport);
      onHistoryLoadChangeRef.current?.(true);
      void onLoadOlderRef
        .current()
        .catch(() => false)
        .finally(() => {
          inFlightRef.current = false;
          onHistoryLoadChangeRef.current?.(false);
        });
    }, 32);
    return () => window.clearTimeout(t);
  }, [enabled, getViewport, hasMore, isLoading, sentinelRef]);
}
