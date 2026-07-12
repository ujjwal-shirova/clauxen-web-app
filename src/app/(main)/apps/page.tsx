"use client";

import { AppsExtensionsView } from "@/frontend/components/apps-extensions-view";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";

export default function AppsPage() {
  const { closeOverlay, openPricing } = useAppOverlays();
  return (
    <AppsExtensionsView onClose={closeOverlay} onUpgradeClick={openPricing} />
  );
}
