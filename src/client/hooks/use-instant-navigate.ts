"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { CLAUXEN_NAVIGATE_EVENT } from "@/hooks/use-document-title";
import { focusAppSurface } from "@/lib/surface-focus";

/**
 * Near-instant in-app navigation: update the URL bar immediately, then soft-sync Next.
 * Supports optional `#hash` (overlays) — Next receives path only; hash is restored.
 *
 * Important: do NOT wrap the Next sync in `startTransition` — that deferred the
 * RSC swap so the URL changed while the panel stayed on the previous page
 * (New Chat / library / projects felt broken).
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
      window.dispatchEvent(
        new CustomEvent(CLAUXEN_NAVIGATE_EVENT, { detail: { path: full } }),
      );

      if (options?.replace) {
        router.replace(pathOnly, { scroll: false });
      } else {
        router.push(pathOnly, { scroll: false });
      }

      // Hand focus to the destination so wheel/hover aren't stuck on the
      // previous sidebar control / page until the user clicks again.
      requestAnimationFrame(() => {
        focusAppSurface();
      });

      if (hash) {
        queueMicrotask(() => {
          if (
            window.location.pathname === pathOnly &&
            window.location.hash !== hash
          ) {
            window.history.replaceState(
              { ...(window.history.state as object), __clxNav: pathOnly },
              "",
              `${pathOnly}${window.location.search}${hash}`,
            );
          }
          // replaceState does not fire hashchange — re-broadcast so overlays sync.
          window.dispatchEvent(
            new CustomEvent(CLAUXEN_NAVIGATE_EVENT, { detail: { path: full } }),
          );
          requestAnimationFrame(() => {
            focusAppSurface();
          });
        });
      }
    },
    [router],
  );
}
