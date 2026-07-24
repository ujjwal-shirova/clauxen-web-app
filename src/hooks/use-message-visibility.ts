"use client";

import { useEffect, useRef, useState } from "react";

export type MessageDetailLevel = "full" | "plain" | "placeholder";

/**
 * Level-of-detail: strip heavy markdown/code when far from viewport.
 * Reserves measured height so swapping renderers does not jump scroll.
 */
export function useMessageDetailLevel(
  enabled: boolean,
  isStreaming: boolean,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  detailLevel: MessageDetailLevel;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [detailLevel, setDetailLevel] = useState<MessageDetailLevel>("full");
  const lockedHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || isStreaming) {
      setDetailLevel("full");
      lockedHeightRef.current = 0;
      const node = ref.current;
      if (node) node.style.minHeight = "";
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setDetailLevel("full");
      return;
    }

    const captureFullHeight = () => {
      const height = node.getBoundingClientRect().height;
      if (height > 0) lockedHeightRef.current = height;
    };

    const applyHeightLock = (level: MessageDetailLevel) => {
      if (level === "full") {
        node.style.minHeight = "";
        // Recapture after paint so the lock matches the restored full tree.
        requestAnimationFrame(captureFullHeight);
        return;
      }
      const locked = lockedHeightRef.current;
      if (locked > 0) {
        node.style.minHeight = `${locked}px`;
      }
    };

    // Seed lock while we are still fully rendered (initial state is "full").
    captureFullHeight();

    const scrollViewport = node.closest<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        let next: MessageDetailLevel = "full";
        if (!entry.isIntersecting) {
          // Far off-screen → placeholder; nearby buffer → plain text.
          const ratio = entry.intersectionRatio;
          next = ratio <= 0 ? "placeholder" : "plain";
        }

        setDetailLevel((prev) => {
          if (prev === next) return prev;
          // Capture full height BEFORE downgrading — otherwise placeholder has
          // no minHeight and scrolling back into the turn hard-jumps the thread.
          if (prev === "full" && next !== "full") {
            captureFullHeight();
          }
          applyHeightLock(next);
          return next;
        });
      },
      {
        // Use the actual nested chat viewport. With root:null, the ScrollArea
        // clipped descendants before the large margin was applied, so heavy
        // markdown swapped in only once it was visibly onscreen.
        root: scrollViewport,
        rootMargin: "150% 0px 150% 0px",
        threshold: [0, 0.01, 0.1],
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      node.style.minHeight = "";
    };
  }, [enabled, isStreaming]);

  return {
    ref,
    detailLevel: isStreaming || !enabled ? "full" : detailLevel,
  };
}
