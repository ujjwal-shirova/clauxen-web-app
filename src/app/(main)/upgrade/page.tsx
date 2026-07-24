"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";

export default function UpgradePage() {
  return <LegacyOverlayRedirect overlay={{ type: "pricing" }} />;
}
