"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { useIsMobile } from "@/frontend/hooks/use-mobile";

const STORAGE_KEY = "clauxen-sidebar-collapsed";
const MOBILE_MQ = "(max-width: 1023px)";

export function useSidebarState() {
  const isMobile = useIsMobile();
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_MQ);
    const syncFromViewport = () => {
      if (mql.matches) {
        setIsSidebarCollapsedState(true);
        return;
      }
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setIsSidebarCollapsedState(stored === "true");
      }
    };
    syncFromViewport();
    setHydrated(true);
    mql.addEventListener("change", syncFromViewport);
    return () => mql.removeEventListener("change", syncFromViewport);
  }, []);

  const setIsSidebarCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setIsSidebarCollapsedState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (
          typeof window !== "undefined" &&
          !window.matchMedia(MOBILE_MQ).matches
        ) {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        }
        return next;
      });
    },
    [],
  );

  return {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated: hydrated,
  };
}
