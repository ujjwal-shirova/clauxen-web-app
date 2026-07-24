import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as billingService from "@/server/services/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ paymentId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    if (!/^pay_[A-Za-z0-9]{8,40}$/.test(params.paymentId)) {
      throw new AppError("Invalid payment id.", 400, "bad_request");
    }
    const result = await billingService.getInvoiceForUser({
      userId: user.id,
      paymentId: params.paymentId,
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
