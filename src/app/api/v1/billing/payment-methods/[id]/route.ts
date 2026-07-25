import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingProfile from "@/server/services/billing-profile.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PATCH = withApiRouteParams<{ id: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    if (!UUID_RE.test(params.id)) {
      throw new AppError("Invalid payment method id.", 400, "bad_request");
    }

    const body = (await request.json()) as { action?: string };
    if (body.action === "set_default") {
      const paymentMethod = await billingProfile.setDefaultPaymentMethodForUser(
        user.id,
        params.id,
      );
      return jsonData({ paymentMethod });
    }

    throw new AppError("Unsupported action.", 400, "bad_request");
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<{ id: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    if (!UUID_RE.test(params.id)) {
      throw new AppError("Invalid payment method id.", 400, "bad_request");
    }
    await billingProfile.deletePaymentMethodForUser(user.id, params.id);
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
