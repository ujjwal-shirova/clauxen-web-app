"use client";

import { cn } from "@/frontend/lib/utils";

/** SVG tip sits near (3, 2) — offset so `x/y` is the click point under the tip. */
export const CURSOR_TIP_OFFSET = { x: 3, y: 2 } as const;

/**
 * Demo-only Mac pointer. Click uses a soft press (scale + tip dip),
 * not a hard cut.
 */
export function MacCursor({
  x,
  y,
  clicking,
  visible,
}: {
  /** Tip position in stage coordinates */
  x: number;
  y: number;
  clicking: boolean;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-40 will-change-transform",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{
        left: x - CURSOR_TIP_OFFSET.x,
        top: y - CURSOR_TIP_OFFSET.y,
        transform: clicking
          ? "scale(0.78) translate(1px, 2px)"
          : "scale(1) translate(0, 0)",
        transformOrigin: `${CURSOR_TIP_OFFSET.x}px ${CURSOR_TIP_OFFSET.y}px`,
        transition: visible
          ? clicking
            ? "transform 120ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 160ms ease"
            : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease"
          : "opacity 160ms ease",
      }}
    >
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
        <path
          d="M3.2 2.1c-.7-.4-1.5.2-1.3 1l3.4 14.2c.2.8 1.2 1 1.7.4l3.1-3.6 3.8 5.6c.4.6 1.3.7 1.8.2l1.4-1.3c.5-.5.5-1.3 0-1.8l-3.8-5.5 4.5-1.2c.8-.2 1-1.3.3-1.7L3.2 2.1Z"
          fill="#18181b"
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
