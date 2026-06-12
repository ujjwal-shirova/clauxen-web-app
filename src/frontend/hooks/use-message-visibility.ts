"use client";

import { useEffect, useRef, useState } from "react";

export type MessageDetailLevel = "full" | "plain" | "placeholder";

/**
 * Level-of-detail: strip heavy markdown/code when far from viewport.
 * Uses IntersectionObserver with rootMargin buffer zones.
 */
export function useMessageDetailLevel(
  enabled: boolean,
  isStreaming: boolean,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  detailLevel: MessageDetailLevel;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [detailLevel, setDetailLevel] =
    useState<MessageDetailLevel>("placeholder");

  useEffect(() => {
    if (!enabled || isStreaming) {
      setDetailLevel("full");
      return;
    }

    const el = ref.current;
    if (!el) return;

    const scrollRoot = el.closest(
      "[data-radix-scroll-area-viewport], [data-virtual-scroll]",
    ) as HTMLElement | null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio > 0.15) {
          setDetailLevel("full");
        } else if (entry.isIntersecting) {
          setDetailLevel("plain");
        } else {
          setDetailLevel("placeholder");
        }
      },
      {
        root: scrollRoot,
        rootMargin: "200px 0px 200px 0px",
        threshold: [0, 0.15, 0.5],
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, isStreaming]);

  return { ref, detailLevel: isStreaming ? "full" : detailLevel };
}
