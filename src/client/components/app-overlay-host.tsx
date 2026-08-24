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
import { chrome } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";

function SettingsLoadingShell() {
  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[200]" role="presentation">
        <div aria-hidden className={chrome.overlay.scrim} />
        <div
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-label="Loading settings"
          data-app-overlay-surface=""
          className={chrome.overlay.modalShell}
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
        className={cn(
          chrome.overlay.surface,
          "overflow-y-auto bg-[var(--pricing-bg,#f0f1f4)] text-[var(--pricing-fg,#14151a)]",
        )}
      >
        <header className="sticky top-0 z-20 flex items-center justify-center border-b border-black/[0.06] bg-[var(--pricing-bg,#f0f1f4)]/95 px-12 py-3.5 sm:py-4">
          <Skeleton className="h-8 w-52 rounded-full" animation="none" />
        </header>

        <main className="mobile-page-inset mx-auto flex w-full max-w-[1152px] flex-col gap-5 py-5 pb-24 sm:gap-6 sm:py-6 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-52 rounded-full" animation="none" />
            <Skeleton className="h-9 w-60 rounded-full" animation="none" />
          </div>

          <div className="relative -mx-4 overflow-hidden">
            <div className="flex items-stretch gap-2.5 overflow-x-auto px-7 py-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="relative flex w-[240px] shrink-0 flex-col rounded-2xl border border-black/[0.06] bg-[var(--pricing-card,#ffffff)] px-[15px] pb-[15px] pt-[13px] shadow-[0_8px_28px_-22px_rgba(20,21,26,0.32)]"
                >
                  <Skeleton className="h-6 w-20 rounded-md" animation="none" />
                  <Skeleton className="mt-2 h-7 w-28 rounded-md" animation="none" />
                  <Skeleton className="mt-2 h-4 w-40 rounded-md" animation="none" />
                  <Skeleton className="mt-3.5 h-9 w-full rounded-full" animation="none" />

                  <Skeleton className="mt-5 h-4 w-28 rounded-md" animation="none" />

                  <div className="mt-3.5 flex flex-col gap-2.5">
                    {Array.from({ length: 6 }).map((_, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-2">
                        <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-full" animation="none" />
                        <Skeleton
                          className={cn(
                            "h-3.5 rounded-md",
                            fIndex % 3 === 0 && "w-full",
                            fIndex % 3 === 1 && "w-[85%]",
                            fIndex % 3 === 2 && "w-[92%]",
                          )}
                          animation="none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
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
        className={chrome.overlay.surface}
      >
        <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-40" variant="text" />
        </div>
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-6 pb-16 pt-6">
          <Skeleton className="h-9 w-64 max-w-full" variant="text" />
          <Skeleton className="h-4 w-full max-w-md" variant="text" />
          <Skeleton className="app-page-card mt-4 h-40 w-full" />
          <Skeleton className="app-page-card h-28 w-full" />
          <Skeleton className="app-page-card h-28 w-full" />
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
