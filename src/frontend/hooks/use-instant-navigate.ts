"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Near-instant in-app navigation: update the URL bar immediately, then soft-sync Next.
 */
export function useInstantNavigate() {
  const router = useRouter();

  return useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof window !== "undefined") {
        const method = options?.replace ? "replaceState" : "pushState";
        window.history[method]({ __clxNav: path }, "", path);
      }
      startTransition(() => {
        if (options?.replace) {
          router.replace(path, { scroll: false });
        } else {
          router.push(path, { scroll: false });
        }
      });
    },
    [router],
  );
}
