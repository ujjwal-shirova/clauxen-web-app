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
import { useRouter } from "next/navigation";
import { useAppPathname } from "@/hooks/use-app-pathname";
import type { SettingsTab } from "@/components/settings/constants";
import {
  APP_ROUTES,
  buildOverlayLocation,
  isMainAppPath,
  overlayToHash,
  parseOverlayHash,
  parseOverlayPath,
  type AppOverlayPath,
} from "@/lib/app-routes";
import { CLAUXEN_NAVIGATE_EVENT } from "@/hooks/use-document-title";

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

/** Prefetch real pages only — overlays are hash fragments, not routes. */
const PREFETCH_PATHS = [
  APP_ROUTES.newChat,
  APP_ROUTES.library,
  APP_ROUTES.projects,
  APP_ROUTES.customize,
  APP_ROUTES.myClauxen,
] as const;

function readOverlayFromHistoryState(): AppOverlayPath | null {
  if (typeof window === "undefined") return null;
  const stateHash = (
    window.history.state as { __clxOverlay?: string | null } | null
  )?.__clxOverlay;
  if (typeof stateHash !== "string" || !stateHash) return null;
  const normalized = stateHash.startsWith("#") ? stateHash : `#${stateHash}`;
  return parseOverlayHash(normalized);
}

function readOverlayFromLocation(): AppOverlayPath | null {
  if (typeof window === "undefined") return null;
  return (
    parseOverlayHash(window.location.hash) ??
    parseOverlayPath(window.location.pathname) ??
    readOverlayFromHistoryState()
  );
}

function parentLocationParts(): { path: string; search: string } {
  if (typeof window === "undefined") {
    return { path: APP_ROUTES.newChat, search: "" };
  }
  const path = window.location.pathname;
  const search = window.location.search;
  if (isMainAppPath(path)) {
    return { path, search };
  }
  return { path: APP_ROUTES.newChat, search: "" };
}

export function AppOverlaysProvider({ children }: { children: ReactNode }) {
  const pathname = useAppPathname();
  const router = useRouter();
  const [overlay, setOverlay] = useState<AppOverlayPath | null>(() =>
    readOverlayFromLocation(),
  );

  useEffect(() => {
    for (const path of PREFETCH_PATHS) {
      try {
        router.prefetch(path);
      } catch {
        // best-effort
      }
    }
  }, [router]);

  /**
   * Migrate legacy path overlays (`/settings/general`, `/upgrade`, …) →
   * parent page + hash so the main shell always has real content underneath.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pathname === "/onboarding" ||
      pathname === "/login" ||
      pathname === "/signup"
    ) {
      return;
    }

    const fromPath = parseOverlayPath(pathname);
    if (!fromPath) return;

    const hash = overlayToHash(fromPath);
    const targetPath = APP_ROUTES.newChat;
    setOverlay(fromPath);

    window.history.replaceState(
      { __clxOverlay: hash, __clxNav: targetPath },
      "",
      `${targetPath}${hash}`,
    );
    startTransition(() => {
      router.replace(targetPath, { scroll: false });
    });
    // Restore hash if Next stripped it during soft nav, then re-sync overlay.
    queueMicrotask(() => {
      if (
        window.location.pathname === targetPath &&
        window.location.hash !== hash
      ) {
        window.history.replaceState(
          { __clxOverlay: hash, __clxNav: targetPath },
          "",
          `${targetPath}${hash}`,
        );
      }
      window.dispatchEvent(
        new CustomEvent(CLAUXEN_NAVIGATE_EVENT, {
          detail: { path: `${targetPath}${hash}` },
        }),
      );
    });
  }, [pathname, router]);

  /** Sync overlay state from hash (mount + popstate / hashchange / soft nav). */
  useEffect(() => {
    const sync = () => {
      setOverlay(readOverlayFromLocation());
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener(CLAUXEN_NAVIGATE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener(CLAUXEN_NAVIGATE_EVENT, sync);
    };
  }, []);

  /** After hosted gift checkout, reopen the gift overlay for the success card. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("giftPurchased") !== "1") return;

    setOverlay({ type: "gift" });
    const { path } = parentLocationParts();
    params.delete("giftPurchased");
    const nextSearch = params.toString();
    const hash = overlayToHash({ type: "gift" });
    window.history.replaceState(
      { __clxOverlay: hash },
      "",
      `${path}${nextSearch ? `?${nextSearch}` : ""}${hash}`,
    );
  }, []);

  /**
   * When pathname changes to a main page, re-read hash after soft-nav microtasks
   * so a briefly-empty hash does not wipe an open settings/pricing overlay.
   */
  useEffect(() => {
    if (!isMainAppPath(pathname)) return;
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const next = readOverlayFromLocation();
      setOverlay(next);
    });
  }, [pathname]);

  const writeOverlayUrl = useCallback(
    (next: AppOverlayPath | null, mode: "push" | "replace") => {
      if (typeof window === "undefined") return;
      const { path, search } = parentLocationParts();
      const url = next
        ? buildOverlayLocation(next, path, search)
        : `${path}${search}`;
      const method = mode === "replace" ? "replaceState" : "pushState";
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current === url) return;
      window.history[method](
        { __clxOverlay: next ? overlayToHash(next) : null },
        "",
        url,
      );
      window.dispatchEvent(
        new CustomEvent(CLAUXEN_NAVIGATE_EVENT, { detail: { path: url } }),
      );
    },
    [],
  );

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    writeOverlayUrl(null, "push");
  }, [writeOverlayUrl]);

  const openOverlay = useCallback(
    (next: Overlay) => {
      if (
        pathname === "/onboarding" ||
        pathname === "/login" ||
        pathname === "/signup"
      ) {
        return;
      }

      const current = readOverlayFromLocation();
      const sameSurface =
        current?.type === next.type &&
        (next.type !== "settings" ||
          (current.type === "settings" &&
            next.type === "settings" &&
            current.tab === next.tab));
      if (sameSurface) {
        setOverlay(next);
        return;
      }

      const tabSwitchOnly =
        current?.type === "settings" && next.type === "settings";
      setOverlay(next);
      writeOverlayUrl(next, tabSwitchOnly ? "replace" : "push");
    },
    [pathname, writeOverlayUrl],
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
