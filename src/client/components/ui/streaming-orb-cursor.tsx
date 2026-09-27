"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";

type StreamingOrbCursorProps = {
  className?: string;
};

/**
 * Streaming caret orb — pulses ink ↔ muted while generating.
 * One consistent size for waiting + mid-stream (no large→small jump).
 */
export function StreamingOrbCursor({ className }: StreamingOrbCursorProps) {
  return (
    <span
      className={cn(
        "streaming-orb-cursor inline-flex shrink-0 align-middle",
        className,
      )}
      aria-hidden
    >
      <span className="orb-cursor-core" />
    </span>
  );
}

/** Places the orb at the end of the latest text node so it tracks tokens. */
export function StreamingFollowCaret({
  active,
  containerRef,
}: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const caretRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    const caret = caretRef.current;
    if (!root || !caret) return;

    let frame = 0;
    const place = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let last: Text | null = null;
      while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        if (text.textContent && text.textContent.length > 0) last = text;
      }
      if (!last?.textContent) {
        caret.style.opacity = "0";
        return;
      }
      const range = document.createRange();
      range.setStart(last, last.textContent.length);
      range.collapse(true);
      const rects = range.getClientRects();
      const rect = rects.length ? rects[rects.length - 1]! : range.getBoundingClientRect();
      const host = root.getBoundingClientRect();
      if (rect.height < 1 && rect.width < 1) {
        caret.style.opacity = "0";
        return;
      }
      caret.style.opacity = "1";
      caret.style.transform = `translate(${Math.max(0, rect.right - host.left + 3)}px, ${Math.max(0, rect.top - host.top + (rect.height - 12) / 2)}px)`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, containerRef]);

  if (!active) return null;
  return (
    <span ref={caretRef} className="streaming-follow-caret" aria-hidden>
      <StreamingOrbCursor />
    </span>
  );
}
