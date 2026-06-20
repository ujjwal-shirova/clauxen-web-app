import { notFound } from "next/navigation";
import { verifyCheckoutSessionToken } from "@/backend/billing/checkout-session";
import { CheckoutSessionClient } from "@/frontend/components/checkout-session-client";

interface CheckoutRouteParams {
  merchant?: string;
  sessionId: string;
}

export default async function CheckoutSessionPage({
  params,
}: {
  params: Promise<CheckoutRouteParams>;
}) {
  const { sessionId } = await params;

  let planIdFromSession: string | null = null;
  let billingCycle: "monthly" | "yearly" = "monthly";
  let maxTier: "5x" | "20x" = "5x";

  try {
    const claims = verifyCheckoutSessionToken(sessionId);
    planIdFromSession = claims.planId;
    if (claims.billingCycle === "yearly") billingCycle = "yearly";
    if (claims.maxTier === "20x" || claims.maxTier === "5x") {
      maxTier = claims.maxTier;
    }
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CheckoutSessionClient
        planId={planIdFromSession}
        initialBillingCycle={billingCycle}
        initialMaxTier={maxTier}
        initialCheckoutSessionId={sessionId}
      />
    </div>
  );
}
