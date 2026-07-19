import { notFound } from "next/navigation";
import {
  normalizeCheckoutReturnPath,
  verifyCheckoutSessionToken,
} from "@/backend/billing/checkout-session";
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
  let returnPath = "/new";

  try {
    const claims = verifyCheckoutSessionToken(sessionId);
    planIdFromSession = claims.planId;
    if (claims.billingCycle === "yearly") billingCycle = "yearly";
    if (claims.maxTier === "20x" || claims.maxTier === "5x") {
      maxTier = claims.maxTier;
    }
    returnPath = normalizeCheckoutReturnPath(claims.returnPath);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--app-shell-bg)]">
      <CheckoutSessionClient
        planId={planIdFromSession}
        initialBillingCycle={billingCycle}
        initialMaxTier={maxTier}
        initialCheckoutSessionId={sessionId}
        returnPath={returnPath}
      />
    </div>
  );
}
