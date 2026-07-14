"use client";

import { LegacyOverlayRedirect } from "@/frontend/components/legacy-overlay-redirect";

export default function GiftPage() {
  return <LegacyOverlayRedirect overlay={{ type: "gift" }} />;
}
