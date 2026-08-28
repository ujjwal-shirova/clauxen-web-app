"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { focusAppSurface } from "@/lib/surface-focus";
import { announceAppNavigation } from "@/hooks/use-app-pathname";

/**
 * Client navigation delegated entirely to the App Router.  Mutating history
 * before `router.push` left Next's router tree on the previous page, which
 * made sidebar destinations appear unresponsive even though the URL changed.
 */
export function useInstantNavigate() {
  const router = useRouter();

  return useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (typeof window === "undefined") return;

      announceAppNavigation(path);

      if (options?.replace) {
        router.replace(path, { scroll: false });
      } else {
        router.push(path, { scroll: false });
      }

      // Hand focus to the destination so wheel/hover aren't stuck on the
      // previous sidebar control / page until the user clicks again.
      requestAnimationFrame(() => {
        focusAppSurface();
      });
    },
    [router],
  );
}
