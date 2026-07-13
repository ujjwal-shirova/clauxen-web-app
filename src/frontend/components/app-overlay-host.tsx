"use client";

import dynamic from "next/dynamic";
import { SoftErrorBoundary } from "@/frontend/components/soft-error-boundary";
import { SettingsErrorBoundary } from "@/frontend/components/settings/settings-error-boundary";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
import { useAuth } from "@/frontend/hooks/use-auth";
import { APP_ROUTES } from "@/frontend/lib/app-routes";
import { useRouter } from "next/navigation";
import { isSettingsTab } from "@/frontend/components/settings/constants";

const UpgradeView = dynamic(
  () =>
    import("@/frontend/components/upgrade-view").then((m) => m.UpgradeView),
  { ssr: false },
);
const GiftView = dynamic(
  () => import("@/frontend/components/gift-view").then((m) => m.GiftView),
  { ssr: false },
);
const AppsExtensionsView = dynamic(
  () =>
    import("@/frontend/components/apps-extensions-view").then(
      (m) => m.AppsExtensionsView,
    ),
  { ssr: false },
);
const SettingsModal = dynamic(
  () =>
    import("@/frontend/components/settings-page").then((m) => m.SettingsModal),
  { ssr: false },
);

/**
 * Hosts fullscreen app surfaces outside the transformed main panel so opens
 * are instant (local state) and cover the real viewport.
 * Overlays are code-split so chat routes do not pay for settings/billing JS.
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
