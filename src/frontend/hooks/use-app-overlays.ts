"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SettingsTab } from "@/frontend/components/settings/constants";

export type Overlay =
  | { type: "pricing" }
  | { type: "apps" }
  | { type: "gift" }
  | { type: "settings"; tab: SettingsTab };

export type OverlayType = Overlay["type"];

function parseHash(hash: string): Overlay | null {
  if (!hash) return null;
  const clean = hash.replace(/^#/, "");
  if (!clean) return null;

  if (clean === "pricing") return { type: "pricing" };
  if (clean === "apps") return { type: "apps" };
  if (clean === "gift") return { type: "gift" };

  if (clean.startsWith("settings")) {
    const parts = clean.split("/");
    const tab = (parts[1] ? decodeURIComponent(parts[1]) : "General") as SettingsTab;
    return { type: "settings", tab };
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
    const current = parseHash(window.location.hash);
    setOverlay(current);
  }, []);

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
    const base = pathname || "/";
    // Remove hash without adding history entry
    router.replace(base, { scroll: false });
    setOverlay(null);
  }, [pathname, router]);

  const openOverlay = useCallback(
    (next: Overlay) => {
      if (typeof window === "undefined") return;
      const base = pathname || "/";
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
