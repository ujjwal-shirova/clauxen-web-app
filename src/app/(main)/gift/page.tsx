"use client";

import { LegacyOverlayRedirect } from "@/components/legacy-overlay-redirect";

export default function GiftPage() {
  return <LegacyOverlayRedirect overlay={{ type: "gift" }} />;
}
