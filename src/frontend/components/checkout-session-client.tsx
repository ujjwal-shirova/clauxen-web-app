"use client";

import { CheckoutPageView } from "@/frontend/components/checkout-page-view";

export function CheckoutSessionClient({
  planId,
  initialBillingCycle,
  initialMaxTier,
  initialCheckoutSessionId,
}: {
  planId: string | null;
  initialBillingCycle: "monthly" | "yearly";
  initialMaxTier: "5x" | "20x";
  initialCheckoutSessionId: string;
}) {
  return (
    <CheckoutPageView
      planId={planId}
      initialBillingCycle={initialBillingCycle}
      initialMaxTier={initialMaxTier}
      initialCheckoutSessionId={initialCheckoutSessionId}
    />
  );
}
