"use client";

import { useEffect } from "react";

/**
 * Clears OAuth / submit busy UI when returning to the auth page.
 * Covers browser-back from Google/GitHub (bfcache) and normal remounts.
 */
export function useClearAuthBusyOnReturn(reset: () => void) {
  useEffect(() => {
    reset();

    const onPageShow = () => reset();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [reset]);
}
