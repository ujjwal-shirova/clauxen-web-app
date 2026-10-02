"use client";

import { useEffect } from "react";
import { resetOAuthNavigation } from "@/contexts/auth-context";

/**
 * Clears OAuth / submit busy UI when returning to the auth page.
 * Covers browser-back from Google/GitHub/GitLab (bfcache) and normal remounts.
 */
export function useClearAuthBusyOnReturn(reset: () => void) {
  useEffect(() => {
    reset();
    resetOAuthNavigation();

    const onReturn = () => {
      reset();
      resetOAuthNavigation();
    };
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [reset]);
}
