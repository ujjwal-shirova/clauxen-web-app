import { useSyncExternalStore } from "react";

/** Viewports below this use the drawer nav (no slim rail); matches Tailwind `lg`. */
const MOBILE_NAV_BREAKPOINT = 1024;

const MOBILE_MQ = `(max-width: ${MOBILE_NAV_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_MQ);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * True for narrow viewports (drawer / touch layout).
 * Uses useSyncExternalStore so server HTML and client hydration stay aligned.
 */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
