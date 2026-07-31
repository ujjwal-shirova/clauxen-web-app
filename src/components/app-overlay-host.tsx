"use client";

import dynamic from "next/dynamic";
import { SoftErrorBoundary } from "@/components/soft-error-boundary";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { SettingsPageSkeleton } from "@/components/settings/settings-page-skeleton";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { useAppOverlays } from "@/hooks/use-app-overlays";
import { useAuth } from "@/hooks/use-auth";
import { APP_ROUTES } from "@/lib/app-routes";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { isSettingsTab } from "@/components/settings/constants";

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
          className="fixed z-[201] flex min-h-0 flex-col overflow-hidden bg-[var(--app-panel-bg)] inset-0 h-[100dvh] w-full md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(960px,calc(100vw-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-[rgba(11,11,11,0.1)] md:shadow-[0_24px_80px_-16px_rgba(24,24,27,0.2)]"
        >
          <SettingsPageSkeleton />
        </div>
      </div>
    </FullscreenPortal>
  );
}

const UpgradeView = dynamic(
  () => import("@/components/upgrade-view").then((m) => m.UpgradeView),
  { ssr: false },
);
const GiftView = dynamic(
  () => import("@/components/gift-view").then((m) => m.GiftView),
  { ssr: false },
);
const AppsExtensionsView = dynamic(
  () =>
    import("@/components/apps-extensions-view").then(
      (m) => m.AppsExtensionsView,
    ),
  { ssr: false },
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
  const instantNavigate = useInstantNavigate();

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
            overlays.closeOverlay();
            instantNavigate(APP_ROUTES.customize);
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
