"use client";

import { useIsClient } from "@/frontend/hooks/use-is-client";
import { Toaster } from "@/frontend/components/ui/toaster";

/** Radix toast IDs differ between SSR and hydration — mount after client. */
export function ClientToaster() {
  const isClient = useIsClient();
  if (!isClient) return null;
  return <Toaster />;
}
