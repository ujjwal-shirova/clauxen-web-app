"use client";

import { BillingCheckout } from "@/components/billing-checkout";
import { updatePendingGiftPurchaseWithPayment } from "@/lib/api/gifts";

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
      giftId={giftCheckout?.giftId ?? null}
      giftDeliveryMethod={giftCheckout?.deliveryMethod ?? null}
      isGiftCheckout={Boolean(giftCheckout)}
      onPaymentSuccess={(details) => {
        if (typeof window === "undefined") return;
        try {
          window.sessionStorage.setItem("clauxen:checkout-success", "1");
          if (giftCheckout) {
            window.sessionStorage.setItem("clauxen:gift-payment-success", "1");
            if (details?.gift) {
              updatePendingGiftPurchaseWithPayment(details.gift);
            }
          }
        } catch {
          /* ignore */
        }
        // Full navigation so the new-chat page mounts the payment popup.
        window.location.replace("/new?checkout=success");
      }}
    />
  );
}
