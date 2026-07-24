"use client";

import { useIsClient } from "@/hooks/use-is-client";
import { Toaster } from "@/components/ui/toaster";

/** Radix toast IDs differ between SSR and hydration — mount after client. */
export function ClientToaster() {
  const isClient = useIsClient();
  if (!isClient) return null;
  return <Toaster />;
}
