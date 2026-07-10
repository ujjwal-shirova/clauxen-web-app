"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export function useAppOverlays() {
  const router = useRouter();
  const pathname = usePathname();
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  // Read current overlay from location (handles direct load + back/forward)
  const syncFromLocation = useCallback(() => {
    if (typeof window === "undefined") return;
    // Never open settings/pricing overlays on auth or onboarding surfaces.
    if (
      pathname === "/onboarding" ||
      pathname === "/login" ||
      pathname === "/signup"
    ) {
      if (window.location.hash) {
        window.history.replaceState(null, "", pathname);
      }
      setOverlay(null);
      return;
    }
    const current = parseHash(window.location.hash);
    setOverlay(current);
  }, [pathname]);

  // Keep in sync with browser navigation
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

  // Also re-sync when pathname changes (we may have navigated to a different base path)
  useEffect(() => {
    syncFromLocation();
  }, [pathname, syncFromLocation]);

  const currentOverlay = overlay;

  const closeOverlay = useCallback(() => {
    if (typeof window === "undefined") return;
    const base = (pathname || "/").split("#")[0];
    // Remove hash without adding history entry
    router.replace(base, { scroll: false });
    setOverlay(null);
  }, [pathname, router]);

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
      const base = (pathname || "/").split("#")[0];
      const hash = buildHash(next);
      const target = `${base}${hash}`;
      // Use replace so opening/closing overlays doesn't pollute history stack
      router.replace(target, { scroll: false });
      setOverlay(next);
    },
    [pathname, router],
  );

  // Convenience helpers (keeps call sites simple and type-safe)
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
    // Generic open if you need to compute dynamically
    openOverlay,
  };
}
