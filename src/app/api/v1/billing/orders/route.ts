import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  buildCheckoutBillingDetailsForUser,
  parseMinimalCheckoutBillingInput,
  resolveCheckoutTaxPaiseForCurrency,
} from "@/backend/billing/checkout-billing";
import {
  assertCheckoutClaimsMatchClientInput,
  resolveCheckoutSubtotalPaise,
} from "@/backend/billing/checkout-pricing";
import * as billingRepo from "@/backend/repositories/billing.repository";
import * as billingService from "@/backend/services/billing.service";
import { AppError, notFound } from "@/backend/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      planId?: string;
      planName?: string;
      billingCycle?: "monthly" | "yearly";
      maxTier?: string;
      seatBreakdown?: Record<string, number>;
      organizationSeatCount?: number;
      billingDetails?: unknown;
      checkoutSessionId?: string;
      currency?: string;
    };

    if (!body.checkoutSessionId) {
      throw new AppError("checkoutSessionId is required.", 400);
    }

    const sessionClaims = billingService.assertCheckoutSessionForUser(
      body.checkoutSessionId,
      user.id,
    );

    assertCheckoutClaimsMatchClientInput(sessionClaims, {
      planId: body.planId,
      billingCycle: body.billingCycle,
      currency: body.currency ?? null,
      maxTier: body.maxTier ?? null,
      seatBreakdown: body.seatBreakdown ?? null,
      organizationSeatCount: body.organizationSeatCount ?? null,
    });

    const minimalBilling = parseMinimalCheckoutBillingInput(body.billingDetails);
    const billingDetails = buildCheckoutBillingDetailsForUser(
      { displayName: user.displayName, email: user.email },
      minimalBilling,
    );

    const plan = await billingRepo.getPlanById(sessionClaims.planId);
    if (!plan) {
      throw notFound("Plan not found.");
    }

    const { subtotalPaise, seatBreakdown, organizationSeatCount } =
      resolveCheckoutSubtotalPaise(sessionClaims, plan);

    const checkoutCurrency = sessionClaims.currency ?? "INR";
    const tax = resolveCheckoutTaxPaiseForCurrency(
      subtotalPaise,
      billingDetails,
      checkoutCurrency,
    );
    const totalPaise = subtotalPaise + tax.taxPaise;

    const checkout = await billingService.createCheckoutOrder({
      userId: user.id,
      userEmail: user.email ?? "",
      planId: plan.id,
      planName: sessionClaims.planName,
      billingCycle: sessionClaims.billingCycle,
      subtotalPaise,
      billingDetails,
      currency: checkoutCurrency,
      maxTier: sessionClaims.maxTier ?? null,
      seatBreakdown,
      organizationSeatCount,
    });

    return jsonData(
      {
        ...checkout,
        pricing: {
          subtotalPaise,
          taxPaise: tax.taxPaise,
          totalPaise,
          taxLabel: tax.taxLabel,
          gstExempt: tax.isGstExempt,
        },
      },
      201,
    );
  },
  { requireAuth: true },
);
