"use client";

import { GiftView } from "@/frontend/components/gift-view";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";

export default function GiftPage() {
  const { closeOverlay } = useAppOverlays();
  return <GiftView onClose={closeOverlay} />;
}
