"use client";

import { useEffect } from "react";

/**
 * Lazily inject streamdown CSS after first paint so the main-route shell
 * does not block on markdown stylesheet parse.
 */
export function StreamdownStyles() {
  useEffect(() => {
    const load = () => {
      void import("streamdown/styles.css");
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === "function") {
      const id = ric(load, { timeout: 1200 });
      return () => {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }

    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
