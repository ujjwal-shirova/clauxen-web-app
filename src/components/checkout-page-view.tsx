"use client";

import { BillingCheckout } from "@/components/billing-checkout";

export function CheckoutPageView({
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
      needsSessionRemint={needsSessionRemint}
      onPaymentSuccess={() => {
        if (typeof window !== "undefined") {
          // Persist across remounts — URL param alone can be stripped before the dialog paints.
          try {
            window.sessionStorage.setItem("clauxen:checkout-success", "1");
          } catch {
            /* ignore */
          }
          const base = returnPath || "/new";
          const sep = base.includes("?") ? "&" : "?";
          window.location.href = `${base}${sep}checkout=success`;
        }
      }}
    />
  );
}
