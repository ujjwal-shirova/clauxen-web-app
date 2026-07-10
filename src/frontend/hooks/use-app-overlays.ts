"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  isSettingsTab,
  type SettingsTab,
} from "@/frontend/components/settings/constants";

export type Overlay =
  | { type: "pricing" }
  | { type: "apps" }
  | { type: "gift" }
  | { type: "settings"; tab: SettingsTab };

export type OverlayType = Overlay["type"];

/** Map removed / renamed settings tabs to the current IA. */
const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  Enterprise: "General",
  "Data controls": "Privacy",
  Apps: "Connectors",
  Voice: "General",
};

function normalizeSettingsTab(value: string): SettingsTab {
  if (isSettingsTab(value)) return value;
  return LEGACY_SETTINGS_TABS[value] ?? "General";
}

function parseHash(hash: string): Overlay | null {
  if (!hash) return null;
  // Browsers can stack fragments after redirects — only honor the first.
  const clean = hash.replace(/^#/, "").split("#")[0] ?? "";
  if (!clean) return null;

  if (clean === "pricing") return { type: "pricing" };
  if (clean === "apps") return { type: "apps" };
  if (clean === "gift") return { type: "gift" };

  if (clean.startsWith("settings")) {
    const parts = clean.split("/");
    const raw = parts[1] ? decodeURIComponent(parts[1]) : "General";
    return { type: "settings", tab: normalizeSettingsTab(raw) };
  }

  return null;
}

function buildHash(overlay: Overlay | null): string {
  if (!overlay) return "";
  switch (overlay.type) {
    case "pricing":
      return "#pricing";
    case "apps":
      return "#apps";
    case "gift":
      return "#gift";
    case "settings":
      return `#settings/${encodeURIComponent(overlay.tab)}`;
    default:
      return "";
  }
}

function currentPathBase(pathname: string | null): string {
  return (pathname || "/").split("#")[0] || "/";
}

/** Hash-only overlay changes must not go through Next router — that can hard-navigate and crash webviews. */
function replaceLocationHash(pathname: string | null, hash: string) {
  if (typeof window === "undefined") return;
  const base = currentPathBase(pathname);
  const next = hash ? `${base}${hash}` : base;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) {
    return;
  }
  window.history.replaceState(window.history.state, "", next);
}

export function useAppOverlays() {
  const pathname = usePathname();
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  const syncFromLocation = useCallback(() => {
    if (typeof window === "undefined") return;
    // Never open settings/pricing overlays on auth or onboarding surfaces.
    if (
      pathname === "/onboarding" ||
      pathname === "/login" ||
      pathname === "/signup"
    ) {
      if (window.location.hash) {
        replaceLocationHash(pathname, "");
      }
      setOverlay(null);
      return;
    }
    const current = parseHash(window.location.hash);
    setOverlay(current);
  }, [pathname]);

  useEffect(() => {
    syncFromLocation();

    const onHash = () => syncFromLocation();
    const onPop = () => syncFromLocation();

    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onPop);
    };
  }, [syncFromLocation]);

  useEffect(() => {
    syncFromLocation();
  }, [pathname, syncFromLocation]);

  const currentOverlay = overlay;

  const closeOverlay = useCallback(() => {
    if (typeof window === "undefined") return;
    replaceLocationHash(pathname, "");
    setOverlay(null);
  }, [pathname]);

  const openOverlay = useCallback(
    (next: Overlay) => {
      if (typeof window === "undefined") return;
      if (
        pathname === "/onboarding" ||
        pathname === "/login" ||
        pathname === "/signup"
      ) {
        return;
      }
      replaceLocationHash(pathname, buildHash(next));
      setOverlay(next);
    },
    [pathname],
  );

  const openPricing = useCallback(() => openOverlay({ type: "pricing" }), [openOverlay]);
  const openApps = useCallback(() => openOverlay({ type: "apps" }), [openOverlay]);
  const openGift = useCallback(() => openOverlay({ type: "gift" }), [openOverlay]);
  const openSettings = useCallback(
    (tab: SettingsTab = "General") => openOverlay({ type: "settings", tab }),
    [openOverlay],
  );

  const isOpen = useMemo(
    () => ({
      pricing: currentOverlay?.type === "pricing",
      apps: currentOverlay?.type === "apps",
      gift: currentOverlay?.type === "gift",
      settings: currentOverlay?.type === "settings",
    }),
    [currentOverlay],
  );

  const settingsTab = currentOverlay?.type === "settings" ? currentOverlay.tab : null;

  return {
    currentOverlay,
    isOpen,
    settingsTab,
    openPricing,
    openApps,
    openGift,
    openSettings,
    closeOverlay,
    openOverlay,
  };
}
