"use client";

import { UpgradeView } from "@/frontend/components/upgrade-view";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";

export default function UpgradePage() {
  const { closeOverlay } = useAppOverlays();
  return <UpgradeView onClose={closeOverlay} />;
}
