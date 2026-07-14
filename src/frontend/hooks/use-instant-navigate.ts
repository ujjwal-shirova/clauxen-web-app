"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Near-instant in-app navigation: update the URL bar immediately, then soft-sync Next.
 * Supports optional `#hash` (overlays) — Next receives path only; hash is restored.
 */
export function useInstantNavigate() {
  const router = useRouter();

  return useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof window === "undefined") return;

      const hashIndex = path.indexOf("#");
      const pathOnly = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
      const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
      const full = `${pathOnly}${hash}`;

      const method = options?.replace ? "replaceState" : "pushState";
      window.history[method]({ __clxNav: pathOnly }, "", full);

      startTransition(() => {
        if (options?.replace) {
          router.replace(pathOnly, { scroll: false });
        } else {
          router.push(pathOnly, { scroll: false });
        }
      });

      if (hash) {
        queueMicrotask(() => {
          if (
            window.location.pathname === pathOnly &&
            window.location.hash !== hash
          ) {
            window.history.replaceState(
              window.history.state,
              "",
              `${pathOnly}${window.location.search}${hash}`,
            );
          }
        });
      }
    },
    [router],
  );
}
