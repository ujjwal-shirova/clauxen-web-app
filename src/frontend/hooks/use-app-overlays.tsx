"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

type AppOverlaysValue = {
  currentOverlay: AppOverlayPath | null;
  isOpen: {
    pricing: boolean;
    apps: boolean;
    gift: boolean;
    settings: boolean;
  };
  settingsTab: SettingsTab | null;
  openPricing: () => void;
  openApps: () => void;
  openGift: () => void;
  openSettings: (tab?: SettingsTab) => void;
  closeOverlay: () => void;
  openOverlay: (next: Overlay) => void;
};

const AppOverlaysContext = createContext<AppOverlaysValue | null>(null);

const PREFETCH_PATHS = [
  APP_ROUTES.newChat,
  APP_ROUTES.upgrade,
  APP_ROUTES.gift,
  APP_ROUTES.apps,
  APP_ROUTES.settings("General"),
  APP_ROUTES.library,
  APP_ROUTES.projects,
  APP_ROUTES.customize,
] as const;

function readOverlayFromLocation(): AppOverlayPath | null {
  if (typeof window === "undefined") return null;
  return parseOverlayPath(window.location.pathname);
}

export function AppOverlaysProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [overlay, setOverlay] = useState<AppOverlayPath | null>(() =>
    parseOverlayPath(pathname),
  );

  // Deep links / Next Link navigations (e.g. /library) sync overlay from pathname.
  useEffect(() => {
    const fromPath = parseOverlayPath(pathname);
    // Only clear/set from Next pathname when it actually matches location —
    // avoids wiping optimistic pushState overlays before Next catches up.
    if (typeof window !== "undefined") {
      const live = window.location.pathname;
      if (live !== pathname && parseOverlayPath(live)) {
        // URL already shows an overlay via pushState; keep local state.
        return;
      }
    }
    setOverlay(fromPath);
  }, [pathname]);

  useEffect(() => {
    for (const path of PREFETCH_PATHS) {
      try {
        router.prefetch(path);
      } catch {
        // best-effort
      }
    }
  }, [router]);

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
    window.history.replaceState(window.history.state, "", base);
    const next = parseOverlayPath(mapped);
    setOverlay(next);
    window.history.pushState({ __clxOverlay: mapped }, "", mapped);
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => {
      setOverlay(readOverlayFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const writeUrl = useCallback((target: string) => {
    if (typeof window === "undefined") return;
    const { pathname: p, search, hash } = window.location;
    if (p === target && !search && !hash) return;
    window.history.pushState({ __clxOverlay: target }, "", target);
  }, []);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    writeUrl(APP_ROUTES.newChat);
    startTransition(() => {
      router.replace(APP_ROUTES.newChat, { scroll: false });
    });
  }, [router, writeUrl]);

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
      setOverlay(next);
      writeUrl(target);
      startTransition(() => {
        router.prefetch(target);
      });
    },
    [pathname, router, writeUrl],
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

  const value = useMemo<AppOverlaysValue>(
    () => ({
      currentOverlay: overlay,
      isOpen: {
        pricing: overlay?.type === "pricing",
        apps: overlay?.type === "apps",
        gift: overlay?.type === "gift",
        settings: overlay?.type === "settings",
      },
      settingsTab: overlay?.type === "settings" ? overlay.tab : null,
      openPricing,
      openApps,
      openGift,
      openSettings,
      closeOverlay,
      openOverlay,
    }),
    [
      overlay,
      openPricing,
      openApps,
      openGift,
      openSettings,
      closeOverlay,
      openOverlay,
    ],
  );

  return (
    <AppOverlaysContext.Provider value={value}>
      {children}
    </AppOverlaysContext.Provider>
  );
}

export function useAppOverlays(): AppOverlaysValue {
  const ctx = useContext(AppOverlaysContext);
  if (!ctx) {
    throw new Error("useAppOverlays must be used within AppOverlaysProvider");
  }
  return ctx;
}
