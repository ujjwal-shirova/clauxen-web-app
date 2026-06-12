import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as billingService from "@/backend/services/billing.service";
import { AppError } from "@/backend/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      qrId?: string;
      billingOrderId?: string;
    };

    if (!body.qrId || !body.billingOrderId) {
      throw new AppError("qrId and billingOrderId are required.", 400);
    }

    const result = await billingService.pollUpiQrPayment({
      userId: user.id,
      qrId: body.qrId,
      billingOrderId: body.billingOrderId,
    });

    return jsonData(result);
  },
  { requireAuth: true },
);
