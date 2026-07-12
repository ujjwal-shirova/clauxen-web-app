"use client";

import { use } from "react";
import { SettingsErrorBoundary } from "@/frontend/components/settings/settings-error-boundary";
import { SettingsModal } from "@/frontend/components/settings-page";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
import { useAuth } from "@/frontend/hooks/use-auth";
import { normalizeSettingsTab } from "@/frontend/lib/app-routes";
import { useRouter } from "next/navigation";

export default function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab: rawTab } = use(params);
  const tab = normalizeSettingsTab(rawTab || "general");
  const auth = useAuth();
  const router = useRouter();
  const { closeOverlay, openSettings, openPricing } = useAppOverlays();

  return (
    <SettingsErrorBoundary onClose={closeOverlay} onReload={closeOverlay}>
      <SettingsModal
        open
        onClose={closeOverlay}
        initialTab={tab}
        onTabChange={(next) => openSettings(next)}
        onGoToCustomize={(section) => {
          router.push(
            section === "connectors" ? "/customize/connectors" : "/customize",
          );
        }}
        onUpgradeClick={openPricing}
        user={auth.user}
        onLogout={() => void auth.logout()}
      />
    </SettingsErrorBoundary>
  );
}
