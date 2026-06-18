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

  const shouldAnimate = enabled && !entered;

  useEffect(() => {
    if (!shouldAnimate) return;
    const timer = window.setTimeout(markEntered, 220);
    return () => window.clearTimeout(timer);
  }, [shouldAnimate, markEntered]);

  return {
    shouldAnimate,
    markEntered,
  };
}
