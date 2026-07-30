"use client";

import { BillingCheckout } from "@/components/billing-checkout";

export function CheckoutPageView({
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
    <BillingCheckout
      onBack={() => {
        if (typeof window !== "undefined") {
          window.location.href = giftCheckout
            ? "/new#gift"
            : returnPath || "/new";
        }
      }}
      planId={planId}
      initialBillingCycle={initialBillingCycle}
      initialMaxTier={initialMaxTier}
      initialCheckoutSessionId={initialCheckoutSessionId}
      returnPath={returnPath}
      needsSessionRemint={needsSessionRemint}
      giftMonths={giftCheckout?.giftMonths ?? null}
      isGiftCheckout={Boolean(giftCheckout)}
      onPaymentSuccess={() => {
        if (typeof window !== "undefined") {
          // Gift checkout: return to gift success UI (copy link / email sent).
          // Do not append checkout=success — that opens the subscription "You're on {plan}" dialog.
          if (giftCheckout) {
            try {
              window.sessionStorage.setItem("clauxen:gift-just-paid", "1");
              window.sessionStorage.removeItem("clauxen:checkout-success");
            } catch {
              /* ignore */
            }
            window.location.href = returnPath || "/new?giftPurchased=1";
            return;
          }

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
