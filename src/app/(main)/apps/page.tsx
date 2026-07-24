"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";

export default function AppsPage() {
  return <LegacyOverlayRedirect overlay={{ type: "apps" }} />;
}
