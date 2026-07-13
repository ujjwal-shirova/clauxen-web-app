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

    const applyHeightLock = (level: MessageDetailLevel) => {
      if (level === "full") {
        // Capture height while fully rendered for later LOD swaps.
        const height = node.getBoundingClientRect().height;
        if (height > 0) lockedHeightRef.current = height;
        node.style.minHeight = "";
        return;
      }
      const locked = lockedHeightRef.current;
      if (locked > 0) {
        node.style.minHeight = `${locked}px`;
      }
    };

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
          applyHeightLock(next);
          return next;
        });
      },
      {
        root: null,
        // Wide margins keep nearby messages at full/plain detail.
        rootMargin: "200% 0px 200% 0px",
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
