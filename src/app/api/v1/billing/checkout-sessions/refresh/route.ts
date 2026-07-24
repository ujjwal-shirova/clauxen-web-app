import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingService from "@/server/services/billing.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remint an expired (but still signed) checkout session for the same user.
 * POST /api/v1/billing/checkout-sessions/refresh
 */
export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as { sessionId?: string };

    if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      throw new AppError("sessionId is required.", 400);
    }

    const checkoutSession = billingService.refreshCheckoutSession({
      userId: user.id,
      sessionId: body.sessionId.trim(),
    });

    return jsonData(checkoutSession, 201);
  },
  { requireAuth: true },
);
