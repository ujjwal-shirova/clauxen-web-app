import { notFound } from "next/navigation";
import {
  inspectCheckoutSessionToken,
  normalizeCheckoutReturnPath,
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

  const inspected = inspectCheckoutSessionToken(sessionId);
  if (inspected.status === "invalid") {
    notFound();
  }

  const claims = inspected.claims;
  const billingCycle =
    claims.billingCycle === "yearly" ? "yearly" : "monthly";
  const maxTier =
    claims.maxTier === "20x" || claims.maxTier === "5x"
      ? claims.maxTier
      : "5x";
  const returnPath = normalizeCheckoutReturnPath(claims.returnPath);

  return (
    <div
      data-checkout-scroll=""
      className="fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--app-shell-bg)] [scrollbar-gutter:stable]"
    >
      <CheckoutSessionClient
        planId={claims.planId}
        initialBillingCycle={billingCycle}
        initialMaxTier={maxTier}
        initialCheckoutSessionId={sessionId}
        returnPath={returnPath}
        needsSessionRemint={inspected.status === "expired"}
      />
    </div>
  );
}
