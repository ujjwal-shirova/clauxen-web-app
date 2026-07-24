import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingService from "@/server/services/billing.service";
import { AppError } from "@/server/db/errors";
import { isCheckoutCurrency } from "@/lib/checkout-currency";

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
      currency?: string;
      returnPath?: string;
    };

    if (typeof body.planId !== "string" || !body.planId.trim()) {
      throw new AppError("planId is required.", 400);
    }
    if (typeof body.planName !== "string" || !body.planName.trim()) {
      throw new AppError("planName is required.", 400);
    }

    const billingCycle = body.billingCycle ?? "monthly";
    if (billingCycle !== "monthly" && billingCycle !== "yearly") {
      throw new AppError("billingCycle must be monthly or yearly.", 400);
    }

    const currency =
      body.currency && isCheckoutCurrency(body.currency) ? body.currency : "INR";

    const checkoutSession = billingService.createCheckoutSession({
      userId: user.id,
      planId: body.planId.trim(),
      planName: body.planName.trim(),
      billingCycle,
      currency,
      maxTier: body.maxTier ?? null,
      seatBreakdown: body.seatBreakdown ?? null,
      organizationSeatCount: body.organizationSeatCount ?? null,
      returnPath:
        typeof body.returnPath === "string" ? body.returnPath : null,
    });

    return jsonData(checkoutSession, 201);
  },
  { requireAuth: true },
);
