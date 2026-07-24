"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";

/** Legacy `/pricing` → `/new#pricing`. */
export default function PricingAliasPage() {
  return <LegacyOverlayRedirect overlay={{ type: "pricing" }} />;
}
