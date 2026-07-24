"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";
import { normalizeSettingsTab } from "@/lib/app-routes";
import { use } from "react";

export default function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = use(params);
  return (
    <LegacyOverlayRedirect
      overlay={{ type: "settings", tab: normalizeSettingsTab(tab) }}
    />
  );
}
