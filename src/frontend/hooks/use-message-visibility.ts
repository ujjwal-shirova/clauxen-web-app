"use client";

import { useRef } from "react";

export type MessageDetailLevel = "full" | "plain" | "placeholder";

/**
 * Level-of-detail: strip heavy markdown/code when far from viewport.
 * Uses IntersectionObserver with rootMargin buffer zones.
 */
export function useMessageDetailLevel(
  _enabled: boolean,
  _isStreaming: boolean,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  detailLevel: MessageDetailLevel;
} {
  const ref = useRef<HTMLDivElement | null>(null);

  // Level-of-detail used to swap full markdown for plain text when a message
  // scrolled off-screen. That changed element heights and, without scroll
  // anchoring, caused the viewport to jump when scrolling up past long answers.
  // Rendering at full detail always keeps scroll position stable; very long
  // conversations are handled by virtualization in ConversationThread instead.
  return { ref, detailLevel: "full" };
}
