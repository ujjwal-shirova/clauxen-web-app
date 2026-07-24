"use client";

import { CheckoutPageView } from "@/components/checkout-page-view";

export function CheckoutSessionClient({
  planId,
  initialBillingCycle,
  initialMaxTier,
  initialCheckoutSessionId,
  returnPath = "/new",
  needsSessionRemint = false,
}: {
  planId: string | null;
  initialBillingCycle: "monthly" | "yearly";
  initialMaxTier: "5x" | "20x";
  initialCheckoutSessionId: string;
  returnPath?: string;
  needsSessionRemint?: boolean;
}) {
  return (
    <CheckoutPageView
      planId={planId}
      initialBillingCycle={initialBillingCycle}
      initialMaxTier={initialMaxTier}
      initialCheckoutSessionId={initialCheckoutSessionId}
      returnPath={returnPath}
      needsSessionRemint={needsSessionRemint}
    />
  );
}
