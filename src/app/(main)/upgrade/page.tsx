"use client";

import { LegacyOverlayRedirect } from "@/frontend/components/legacy-overlay-redirect";

export default function UpgradePage() {
  return <LegacyOverlayRedirect overlay={{ type: "pricing" }} />;
}
