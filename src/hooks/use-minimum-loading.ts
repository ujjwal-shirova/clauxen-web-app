"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps loading UI visible for at least `minimumMs` to avoid jarring flashes
 * when data resolves very quickly (common with cached or local defaults).
 */
export function useMinimumLoadingTime(isLoading: boolean, minimumMs = 450) {
  const [visible, setVisible] = useState(isLoading);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      startedAtRef.current = Date.now();
      setVisible(true);
      return;
    }

    if (startedAtRef.current === null) {
      setVisible(false);
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = minimumMs - elapsed;

    if (remaining <= 0) {
      startedAtRef.current = null;
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      startedAtRef.current = null;
      setVisible(false);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [isLoading, minimumMs]);

  return visible;
}
