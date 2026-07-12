"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SettingsTab } from "@/frontend/components/settings/constants";
import {
  APP_ROUTES,
  legacyHashToPath,
  overlayToPath,
  parseOverlayPath,
  type AppOverlayPath,
} from "@/frontend/lib/app-routes";

export type Overlay = AppOverlayPath;
export type OverlayType = Overlay["type"];

/**
 * Path-based app surfaces (upgrade / gift / apps / settings).
 * URLs are shareable; avoids hash + Next router hydration races.
 */
export function useAppOverlays() {
  const pathname = usePathname();
  const router = useRouter();

  const currentOverlay = useMemo(
    () => parseOverlayPath(pathname),
    [pathname],
  );

  // One-shot migration: #pricing → /upgrade (and friends).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pathname === "/onboarding" ||
      pathname === "/login" ||
      pathname === "/signup"
    ) {
      return;
    }
    const mapped = legacyHashToPath(window.location.hash);
    if (!mapped) return;
    const base = `${window.location.pathname}${window.location.search}`;
    // Strip hash then navigate to canonical path.
    window.history.replaceState(window.history.state, "", base);
    router.replace(mapped, { scroll: false });
  }, [pathname, router]);

  const closeOverlay = useCallback(() => {
    // Always land on a real app path (avoids blank history / external referrer).
    router.push(APP_ROUTES.newChat, { scroll: false });
  }, [router]);

  const openOverlay = useCallback(
    (next: Overlay) => {
      if (
        pathname === "/onboarding" ||
        pathname === "/login" ||
        pathname === "/signup"
      ) {
        return;
      }
      const target = overlayToPath(next);
      if (pathname === target) return;
      router.push(target, { scroll: false });
    },
    [pathname, router],
  );

  const openPricing = useCallback(
    () => openOverlay({ type: "pricing" }),
    [openOverlay],
  );
  const openApps = useCallback(
    () => openOverlay({ type: "apps" }),
    [openOverlay],
  );
  const openGift = useCallback(
    () => openOverlay({ type: "gift" }),
    [openOverlay],
  );
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

  const settingsTab =
    currentOverlay?.type === "settings" ? currentOverlay.tab : null;

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
