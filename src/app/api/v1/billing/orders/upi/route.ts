import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  buildCheckoutBillingDetailsForUser,
  parseMinimalCheckoutBillingInput,
  resolveCheckoutTaxPaiseForCurrency,
} from "@/server/billing/checkout-billing";
import {
  assertCheckoutClaimsMatchClientInput,
  resolveCheckoutSubtotalPaise,
} from "@/server/billing/checkout-pricing";
import * as billingRepo from "@/server/repositories/billing.repository";
import * as billingService from "@/server/services/billing.service";
import { AppError, notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      checkoutSessionId?: string;
      billingDetails?: unknown;
      seatBreakdown?: Record<string, number>;
      organizationSeatCount?: number;
    };

    if (!body.checkoutSessionId) {
      throw new AppError("checkoutSessionId is required.", 400);
    }

    const claims = billingService.assertCheckoutSessionForUser(
      body.checkoutSessionId,
      user.id,
    );

    assertCheckoutClaimsMatchClientInput(claims, {
      seatBreakdown: body.seatBreakdown ?? null,
      organizationSeatCount: body.organizationSeatCount ?? null,
    });

    const plan = await billingRepo.getPlanById(claims.planId);
    if (!plan) {
      throw notFound("Plan not found.");
    }

    const { subtotalPaise, seatBreakdown, organizationSeatCount } =
      resolveCheckoutSubtotalPaise(claims, plan);

    const minimalBilling = parseMinimalCheckoutBillingInput(body.billingDetails);
    const billingDetails = buildCheckoutBillingDetailsForUser(
      { displayName: user.displayName, email: user.email },
      minimalBilling,
    );

    const checkoutCurrency = claims.currency ?? "INR";
    if (checkoutCurrency !== "INR") {
      throw new AppError(
        "UPI is only available for INR checkout.",
        400,
        "invalid_currency",
      );
    }

    const tax = resolveCheckoutTaxPaiseForCurrency(
      subtotalPaise,
      billingDetails,
      checkoutCurrency,
    );

    const checkout = await billingService.createUpiCheckoutPayment({
      userId: user.id,
      userEmail: user.email ?? "",
      sessionId: body.checkoutSessionId,
      billingDetails,
      planId: plan.id,
      planName: claims.planName,
      billingCycle: claims.billingCycle,
      subtotalPaise,
      currency: checkoutCurrency,
      maxTier: claims.maxTier ?? null,
      seatBreakdown,
      organizationSeatCount,
    });

    return jsonData(
      {
        ...checkout,
        pricing: {
          subtotalPaise,
          taxPaise: tax.taxPaise,
          totalPaise: subtotalPaise + tax.taxPaise,
          taxLabel: tax.taxLabel,
          gstExempt: tax.isGstExempt,
        },
      },
      201,
    );
  },
  { requireAuth: true },
);
