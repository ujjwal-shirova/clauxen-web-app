import { withApiRouteParams } from "@/server/http/route-params";
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

    // Ownership check + generate PDF on demand when missing from R2.
    const pdfRes = await billingService.ensureInvoicePdfForUser({
      userId: user.id,
      paymentId: params.paymentId,
    });

    return new Response(pdfRes.body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="shirova-invoice-${params.paymentId}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  },
  { requireAuth: true },
);
