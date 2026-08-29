"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "clauxen-sidebar-collapsed";
const MOBILE_MQ = "(max-width: 1023px)";

const desktopSidebarListeners = new Set<() => void>();
const mobileSidebarListeners = new Set<() => void>();

/** Shared across all useSidebarState() callers — mobile drawer open/closed. */
let mobileSidebarCollapsed = true;

function emitMobileSidebarChange() {
  mobileSidebarListeners.forEach((listener) => listener());
}

function subscribeMobileSidebar(callback: () => void) {
  mobileSidebarListeners.add(callback);
  return () => mobileSidebarListeners.delete(callback);
}

function getMobileSidebarCollapsedSnapshot(): boolean {
  return mobileSidebarCollapsed;
}

function getMobileSidebarCollapsedServerSnapshot(): boolean {
  return true;
}

function setMobileSidebarCollapsed(
  value: boolean | ((prev: boolean) => boolean),
) {
  const prev = mobileSidebarCollapsed;
  const next = typeof value === "function" ? value(prev) : value;
  if (next === prev) return;
  mobileSidebarCollapsed = next;
  emitMobileSidebarChange();
}

function emitDesktopSidebarChange() {
  desktopSidebarListeners.forEach((listener) => listener());
}

function subscribeDesktopSidebar(callback: () => void) {
  desktopSidebarListeners.add(callback);
  return () => {
    desktopSidebarListeners.delete(callback);
  };
}

function getDesktopSidebarCollapsedSnapshot(): boolean {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  // Default expanded on first visit / reload with no preference stored.
  return false;
}

function getDesktopSidebarCollapsedServerSnapshot(): boolean {
  // Match default expanded chrome to avoid a collapsed→expanded flash.
  return false;
}

function subscribeMobile(callback: () => void) {
  const mql = window.matchMedia(MOBILE_MQ);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

export function useSidebarState() {
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );
  const desktopCollapsed = useSyncExternalStore(
    subscribeDesktopSidebar,
    getDesktopSidebarCollapsedSnapshot,
    getDesktopSidebarCollapsedServerSnapshot,
  );
  const mobileCollapsed = useSyncExternalStore(
    subscribeMobileSidebar,
    getMobileSidebarCollapsedSnapshot,
    getMobileSidebarCollapsedServerSnapshot,
  );
  const [sidebarHydrated, setSidebarHydrated] = useState(false);

  useLayoutEffect(() => {
    setSidebarHydrated(true);
  }, []);

  useLayoutEffect(() => {
    if (isMobile) {
      setMobileSidebarCollapsed(true);
    }
  }, [isMobile]);

  const isSidebarCollapsed = isMobile ? mobileCollapsed : desktopCollapsed;

  const setIsSidebarCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia(MOBILE_MQ).matches
      ) {
        setMobileSidebarCollapsed(value);
        return;
      }

      const prev = getDesktopSidebarCollapsedSnapshot();
      const next = typeof value === "function" ? value(prev) : value;
      // Reloads retain the choice, while a new browser session starts with
      // the sidebar expanded again.
      window.sessionStorage.setItem(STORAGE_KEY, String(next));
      emitDesktopSidebarChange();
    },
    [],
  );

  return {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  };
}
