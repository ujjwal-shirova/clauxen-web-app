"use client";

import { LegacyOverlayRedirect } from "@/frontend/components/legacy-overlay-redirect";

export default function AppsPage() {
  return <LegacyOverlayRedirect overlay={{ type: "apps" }} />;
}
