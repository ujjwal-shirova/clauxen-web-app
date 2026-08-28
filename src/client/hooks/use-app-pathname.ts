"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CLAUXEN_NAVIGATE_EVENT } from "@/hooks/use-document-title";

let optimisticPathname: string | null = null;

/** Paint shell route state immediately while Next commits its router tree. */
export function announceAppNavigation(path: string): void {
  if (typeof window === "undefined") return;
  optimisticPathname = new URL(path, window.location.href).pathname;
  window.dispatchEvent(new Event(CLAUXEN_NAVIGATE_EVENT));
}

function readWindowPathname(): string {
  if (typeof window === "undefined") return "";
  return optimisticPathname ?? window.location.pathname ?? "";
}

function subscribeToSoftNav(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onNav = () => onStoreChange();
  const onPopState = () => {
    optimisticPathname = null;
    onStoreChange();
  };
  window.addEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);
  window.addEventListener("popstate", onPopState);
  return () => {
    window.removeEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);
    window.removeEventListener("popstate", onPopState);
  };
}

/**
 * Pathname that updates on soft-nav `pushState` immediately — not only after
 * Next finishes `router.push`. Use this for shell chrome and ChatView routing
 * decisions so New Chat / page clicks paint before the RSC tree catches up.
 */
export function useAppPathname(): string {
  const nextPathname = usePathname() || "";
  const livePathname = useSyncExternalStore(
    subscribeToSoftNav,
    readWindowPathname,
    () => nextPathname,
  );

  useEffect(() => {
    if (optimisticPathname === nextPathname) optimisticPathname = null;
  }, [nextPathname]);

  // Prefer the live window path when it has already moved ahead of Next.
  if (livePathname && livePathname !== nextPathname) {
    return livePathname;
  }
  return nextPathname || livePathname;
}

/** Full path + search + hash, kept in sync with soft-nav. */
export function useAppLocation(): string {
  const nextPathname = usePathname() || "";
  const [location, setLocation] = useState(() =>
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : nextPathname,
  );

  useEffect(() => {
    const sync = () => {
      setLocation(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
    };
    sync();
    window.addEventListener(CLAUXEN_NAVIGATE_EVENT, sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener(CLAUXEN_NAVIGATE_EVENT, sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [nextPathname]);

  return location;
}
