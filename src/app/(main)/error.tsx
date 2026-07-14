"use client";

import { useEffect, useRef } from "react";

/**
 * Route-level recovery with ZERO user-facing error chrome.
 * Soft-resets the segment first; only hard-reloads after repeated failure.
 * Never shows "Try again" / "New chat" / "couldn't load".
 */
export default function MainAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tried = useRef(false);

  useEffect(() => {
    console.error("[main] silent recover:", error?.message, error?.digest);
  }, [error]);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;

    const key = "clx_main_err_n";
    let n = 0;
    try {
      n = Number(sessionStorage.getItem(key) || "0");
    } catch {
      n = 0;
    }

    if (n < 2) {
      try {
        sessionStorage.setItem(key, String(n + 1));
      } catch {
        /* ignore */
      }
      const t = window.setTimeout(() => reset(), 80);
      return () => window.clearTimeout(t);
    }

    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    const href =
      window.location.pathname +
      window.location.search +
      window.location.hash;
    window.location.replace(href || "/");
  }, [reset]);

  // Invisible placeholder — matches the app shell background, no copy/buttons.
  return (
    <div
      className="min-h-[100dvh] w-full bg-[var(--app-shell-bg)]"
      aria-busy="true"
    />
  );
}
