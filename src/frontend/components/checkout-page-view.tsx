"use client";

import { BillingCheckout } from "@/frontend/components/billing-checkout";

export function CheckoutPageView({
  planId,
  initialBillingCycle,
  initialMaxTier,
  initialCheckoutSessionId,
  returnPath = "/new",
}: {
  planId: string | null;
  initialBillingCycle: "monthly" | "yearly";
  initialMaxTier: "5x" | "20x";
  initialCheckoutSessionId: string;
  returnPath?: string;
}) {
  return (
    <BillingCheckout
      onBack={() => {
        if (typeof window !== "undefined") {
          window.location.href = returnPath || "/new";
        }
      }}
      planId={planId}
      initialBillingCycle={initialBillingCycle}
      initialMaxTier={initialMaxTier}
      initialCheckoutSessionId={initialCheckoutSessionId}
      returnPath={returnPath}
      onPaymentSuccess={() => {
        if (typeof window !== "undefined") {
          const base = returnPath || "/new";
          const sep = base.includes("?") ? "&" : "?";
          window.location.href = `${base}${sep}checkout=success`;
        }
      }}
    />
  );
}
