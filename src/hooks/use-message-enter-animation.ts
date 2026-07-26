"use client";

import { useCallback, useEffect, useState } from "react";

/** Message ids that already played their one-time enter fade. */
const enteredMessageIds = new Set<string>();

/**
 * Run the enter fade animation once per message id, then keep content fully visible.
 */
export function useMessageEnterAnimation(
  messageId: string,
  enabled: boolean,
): {
  shouldAnimate: boolean;
  markEntered: () => void;
} {
  const [entered, setEntered] = useState(() => enteredMessageIds.has(messageId));

  const markEntered = useCallback(() => {
    if (enteredMessageIds.has(messageId)) return;
    enteredMessageIds.add(messageId);
    setEntered(true);
  }, [messageId]);

  const motionReduced =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-reduce-motion") === "1";
  const shouldAnimate = enabled && !entered && !motionReduced;

  useEffect(() => {
    if (!enabled || entered) return;
    if (motionReduced) {
      markEntered();
      return;
    }
    if (!shouldAnimate) return;
    const timer = window.setTimeout(markEntered, 220);
    return () => window.clearTimeout(timer);
  }, [shouldAnimate, markEntered, enabled, entered, motionReduced]);

  return {
    shouldAnimate,
    markEntered,
  };
}
