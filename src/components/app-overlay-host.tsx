"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { SoftErrorBoundary } from "@/components/soft-error-boundary";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { SettingsPageSkeleton } from "@/components/settings/settings-page-skeleton";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { useAppOverlays } from "@/hooks/use-app-overlays";
import { useAuth } from "@/hooks/use-auth";
import { isSettingsTab } from "@/components/settings/constants";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsLoadingShell() {
  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[200]" role="presentation">
        <div
          aria-hidden
          className="absolute inset-0 bg-[rgba(244,244,245,0.84)] dark:bg-black/70"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-label="Loading settings"
          data-app-overlay-surface=""
          className="fixed z-[201] flex min-h-0 flex-col overflow-hidden bg-[var(--app-panel-bg)] inset-0 h-[100dvh] w-full md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(960px,calc(100vw-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-[rgba(11,11,11,0.1)] md:shadow-[0_24px_80px_-16px_rgba(24,24,27,0.2)]"
        >
          <SettingsPageSkeleton />
        </div>
      </div>
    </FullscreenPortal>
  );
}

function PricingLoadingShell() {
  return (
    <FullscreenPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-label="Loading pricing"
        data-app-overlay-surface=""
        tabIndex={-1}
        className="fixed inset-0 z-[200] overflow-y-auto bg-[var(--app-shell-bg)] outline-none"
      >
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-6 pb-16 pt-10 sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-40" variant="text" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-10 w-72 max-w-full" variant="text" />
            <Skeleton className="h-4 w-56 max-w-full" variant="text" />
            <Skeleton className="mt-2 h-9 w-44 rounded-full" />
          </div>
          <div className="flex gap-5 overflow-hidden px-2 py-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex w-[240px] shrink-0 flex-col rounded-xl border border-zinc-200/80 bg-white p-5"
              >
                <Skeleton className="h-4 w-16" variant="text" />
                <Skeleton className="mt-4 h-8 w-24" variant="text" />
                <Skeleton className="mt-2 h-3 w-28" variant="text" />
                <Skeleton className="mt-5 h-9 w-full rounded-lg" />
                <div className="mt-5 space-y-2.5">
                  <Skeleton className="h-3 w-full" variant="text" />
                  <Skeleton className="h-3 w-[90%]" variant="text" />
                  <Skeleton className="h-3 w-[80%]" variant="text" />
                  <Skeleton className="h-3 w-[85%]" variant="text" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}

function OverlayPageLoadingShell({ label }: { label: string }) {
  return (
    <FullscreenPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-label={label}
        data-app-overlay-surface=""
        tabIndex={-1}
        className="fixed inset-0 z-[200] flex min-h-0 flex-col overflow-hidden bg-[var(--app-shell-bg)] outline-none"
      >
        <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-40" variant="text" />
        </div>
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-6 pb-16 pt-6">
          <Skeleton className="h-9 w-64 max-w-full" variant="text" />
          <Skeleton className="h-4 w-full max-w-md" variant="text" />
          <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </FullscreenPortal>
  );
}

const UpgradeView = dynamic(
  () => import("@/components/upgrade-view").then((m) => m.UpgradeView),
  { ssr: false, loading: () => <PricingLoadingShell /> },
);
const GiftView = dynamic(
  () => import("@/components/gift-view").then((m) => m.GiftView),
  { ssr: false, loading: () => <OverlayPageLoadingShell label="Loading gift" /> },
);
const AppsExtensionsView = dynamic(
  () =>
    import("@/components/apps-extensions-view").then(
      (m) => m.AppsExtensionsView,
    ),
  {
    ssr: false,
    loading: () => <OverlayPageLoadingShell label="Loading apps" />,
  },
);
const SettingsModal = dynamic(
  () => import("@/components/settings-page").then((m) => m.SettingsModal),
  { ssr: false, loading: () => <SettingsLoadingShell /> },
);

/**
 * Hosts fullscreen app surfaces outside the transformed main panel so opens
 * are instant (local state) and cover the real viewport.
 * Overlays are code-split so chat routes do not pay for settings/billing JS.
 */
export function AppOverlayHost() {
  const overlays = useAppOverlays();
  const auth = useAuth();

  // Warm overlay chunks so Settings / Pricing / Gift open without a blank wait.
  useEffect(() => {
    const warm = () => {
      void import("@/components/upgrade-view");
      void import("@/components/settings-page");
      void import("@/components/gift-view");
      void import("@/components/apps-extensions-view");
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(warm, { timeout: 8000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(warm, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!overlays.currentOverlay) return null;

  if (overlays.currentOverlay.type === "pricing") {
    return (
      <SoftErrorBoundary name="pricing">
        <UpgradeView onClose={overlays.closeOverlay} />
      </SoftErrorBoundary>
    );
  }

  if (overlays.currentOverlay.type === "gift") {
    return (
      <SoftErrorBoundary name="gift">
        <GiftView onClose={overlays.closeOverlay} />
      </SoftErrorBoundary>
    );
  }

  if (overlays.currentOverlay.type === "apps") {
    return (
      <SoftErrorBoundary name="apps">
        <AppsExtensionsView
          onClose={overlays.closeOverlay}
          onUpgradeClick={() => overlays.openPricing()}
        />
      </SoftErrorBoundary>
    );
  }

  if (overlays.currentOverlay.type === "settings") {
    const tab =
      overlays.settingsTab && isSettingsTab(overlays.settingsTab)
        ? overlays.settingsTab
        : "General";
    return (
      <SettingsErrorBoundary onClose={overlays.closeOverlay}>
        <SettingsModal
          open
          onClose={overlays.closeOverlay}
          initialTab={tab}
          onTabChange={(next) => overlays.openSettings(next)}
          onGoToCustomize={(section) => {
            if (section === "connectors") {
              overlays.openSettings("Connectors");
              return;
            }
            overlays.openSettings("Skills");
          }}
          onUpgradeClick={() => overlays.openPricing()}
          user={auth.user}
          onLogout={() => void auth.logout()}
        />
      </SettingsErrorBoundary>
    );
  }

  return null;
}
