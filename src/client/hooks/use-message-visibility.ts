"use client";

import { useRef } from "react";

export type MessageDetailLevel = "full" | "plain" | "placeholder";

/**
 * Level-of-detail hook. Historically this swapped each assistant message
 * between full markdown and cheap plain-text renderers via IntersectionObserver
 * as it moved through the viewport.
 *
 * That swap is the flicker: remounting the Streamdown tree re-parses markdown,
 * re-tokenizes every code block, and rebuilds tables at a different height
 * than the min-height lock captured — so scrolling (especially upward through
 * code/table blocks) visibly jumps. The transcript now keeps one stable DOM
 * tree per message and isolates layout cost with CSS containment instead
 * (`contain: layout style` on turns and blocks). Off-screen paint is already
 * skipped by the browser compositor, so nothing else is needed.
 *
 * The hook (and the `MessageDetailLevel` type) stays so existing call sites
 * keep compiling; it always reports `full`.
 */
export function useMessageDetailLevel(
  _enabled: boolean,
  _isStreaming: boolean,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  detailLevel: MessageDetailLevel;
} {
  const ref = useRef<HTMLDivElement | null>(null);

  return {
    ref,
    detailLevel: "full",
  };
}
