"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";

/** Legacy `/settings` → `/new#settings`. */
export default function SettingsIndexPage() {
  return (
    <LegacyOverlayRedirect overlay={{ type: "settings", tab: "General" }} />
  );
}
