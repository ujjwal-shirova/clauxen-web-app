"use client";

import { CheckoutPageView } from "@/components/checkout-page-view";

export function CheckoutSessionClient({
  planId,
  initialBillingCycle,
  initialMaxTier,
  initialCheckoutSessionId,
  returnPath = "/new",
  needsSessionRemint = false,
  giftCheckout = null,
}: {
  planId: string | null;
  initialBillingCycle: "monthly" | "yearly";
  initialMaxTier: "5x" | "20x";
  initialCheckoutSessionId: string;
  returnPath?: string;
  needsSessionRemint?: boolean;
  giftCheckout?: {
    giftId: string | null;
    giftMonths: number;
    deliveryMethod: "email" | "link" | null;
  } | null;
}) {
  return (
    <CheckoutPageView
      planId={planId}
      initialBillingCycle={initialBillingCycle}
      initialMaxTier={initialMaxTier}
      initialCheckoutSessionId={initialCheckoutSessionId}
      returnPath={returnPath}
      needsSessionRemint={needsSessionRemint}
      giftCheckout={giftCheckout}
    />
  );
}
