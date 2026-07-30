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

    // Gift checkout reuses the Razorpay order created at purchase time.
    if (
      sessionClaims.orderKind === "gift" &&
      typeof sessionClaims.giftId === "string" &&
      sessionClaims.giftId
    ) {
      const { getGiftCheckoutOrderForUser } = await import(
        "@/server/services/gift.service"
      );
      const giftCheckout = await getGiftCheckoutOrderForUser(
        user.id,
        sessionClaims.giftId,
      );
      return jsonData(
        {
          order: {
            id: giftCheckout.order.id,
            razorpay_order_id: giftCheckout.order.razorpay_order_id,
          },
          razorpay: giftCheckout.razorpay,
          pricing: {
            subtotalPaise: giftCheckout.pricing.subtotalPaise,
            taxPaise: giftCheckout.pricing.taxPaise,
            totalPaise: giftCheckout.pricing.amountPaise,
            taxLabel: giftCheckout.pricing.taxPaise > 0 ? "Tax (18% GST)" : null,
            gstExempt: giftCheckout.pricing.taxPaise === 0,
          },
        },
        201,
      );
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
