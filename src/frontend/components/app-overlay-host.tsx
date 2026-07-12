"use client";

import { SoftErrorBoundary } from "@/frontend/components/soft-error-boundary";
import { SettingsErrorBoundary } from "@/frontend/components/settings/settings-error-boundary";
import { UpgradeView } from "@/frontend/components/upgrade-view";
import { GiftView } from "@/frontend/components/gift-view";
import { AppsExtensionsView } from "@/frontend/components/apps-extensions-view";
import { SettingsModal } from "@/frontend/components/settings-page";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
import { useAuth } from "@/frontend/hooks/use-auth";
import { APP_ROUTES } from "@/frontend/lib/app-routes";
import { useRouter } from "next/navigation";
import { isSettingsTab } from "@/frontend/components/settings/constants";

/**
 * Hosts fullscreen app surfaces outside the transformed main panel so opens
 * are instant (local state) and cover the real viewport.
 */
export function AppOverlayHost() {
  const overlays = useAppOverlays();
  const auth = useAuth();
  const router = useRouter();

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
      <SettingsErrorBoundary
        onClose={overlays.closeOverlay}
        onReload={overlays.closeOverlay}
      >
        <SettingsModal
          open
          onClose={overlays.closeOverlay}
          initialTab={tab}
          onTabChange={(next) => overlays.openSettings(next)}
          onGoToCustomize={(section) => {
            overlays.closeOverlay();
            router.push(
              section === "connectors"
                ? "/customize/connectors"
                : APP_ROUTES.customize,
            );
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
