import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  billingDetailsForTax,
  buildCheckoutBillingDetailsForUser,
  parseMinimalCheckoutBillingInput,
  resolveCheckoutTaxPaiseForCurrency,
} from "@/server/billing/checkout-billing";
import {
  assertCheckoutClaimsMatchClientInput,
  resolveCheckoutSubtotalPaise,
} from "@/server/billing/checkout-pricing";
import {
  resolveIpCountry,
  resolveOrderTimeLocation,
} from "@/server/billing/checkout-location";
import * as billingService from "@/server/services/billing.service";
import * as billingRepo from "@/server/repositories/billing.repository";
import { AppError, notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      checkoutSessionId?: string;
      billingDetails?: unknown;
      customerContact?: string;
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

    if (claims.orderKind === "gift" && claims.giftId) {
      const checkout = await billingService.createGiftUpiCheckoutPayment({
        userId: user.id,
        userEmail: user.email ?? "",
        giftId: claims.giftId,
        sessionId: body.checkoutSessionId,
        customerContact:
          typeof body.customerContact === "string"
            ? body.customerContact.trim() || undefined
            : undefined,
        planName: claims.planName,
      });
      return jsonData(
        {
          ...checkout,
          pricing: {
            subtotalPaise: checkout.pricing.subtotalPaise,
            taxPaise: checkout.pricing.taxPaise,
            totalPaise: checkout.pricing.amountPaise,
            taxLabel:
              checkout.pricing.taxPaise > 0 ? "Tax (18% GST)" : null,
            gstExempt: checkout.pricing.taxPaise === 0,
          },
        },
        201,
      );
    }

    const { subtotalPaise, seatBreakdown, organizationSeatCount } =
      resolveCheckoutSubtotalPaise(claims, plan);

    const minimalBilling = parseMinimalCheckoutBillingInput(body.billingDetails);
    const billingDetails = buildCheckoutBillingDetailsForUser(
      { displayName: user.displayName, email: user.email },
      minimalBilling,
    );

    const payLocation = resolveOrderTimeLocation({
      declaredCountry: billingDetails.countryCode,
      ipCountry: claims.ipCountry ?? resolveIpCountry(request.headers),
    });
    const checkoutCurrency = payLocation.currency;
    if (checkoutCurrency !== "INR" || payLocation.effectiveCountry !== "IN") {
      throw new AppError(
        "UPI is only available for Indian rupee checkout.",
        400,
        "invalid_currency",
      );
    }

    const tax = resolveCheckoutTaxPaiseForCurrency(
      subtotalPaise,
      billingDetailsForTax(billingDetails, payLocation.effectiveCountry),
      checkoutCurrency,
    );

    const customerContact =
      typeof body.customerContact === "string"
        ? body.customerContact.trim()
        : "";

    const checkout = await billingService.createUpiCheckoutPayment({
      userId: user.id,
      userEmail: user.email ?? "",
      sessionId: body.checkoutSessionId,
      billingDetails,
      customerContact: customerContact || undefined,
      planId: plan.id,
      planName: claims.planName,
      billingCycle: claims.billingCycle,
      subtotalPaise,
      currency: checkoutCurrency,
      location: payLocation.evidence,
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
