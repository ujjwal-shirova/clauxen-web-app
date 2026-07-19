import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import {
  fetchInvoicePdfFromWorker,
} from "@/backend/billing/billing-worker";
import * as billingService from "@/backend/services/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ paymentId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    if (!/^pay_[A-Za-z0-9]{8,40}$/.test(params.paymentId)) {
      throw new AppError("Invalid payment id.", 400, "bad_request");
    }

    // Ownership check before proxying to Cloudflare.
    await billingService.getInvoiceForUser({
      userId: user.id,
      paymentId: params.paymentId,
    });

    const pdfRes = await fetchInvoicePdfFromWorker({
      paymentId: params.paymentId,
      userId: user.id,
    });

    if (!pdfRes) {
      throw new AppError(
        "Invoice PDF service is not configured yet.",
        503,
        "billing_unavailable",
      );
    }

    if (!pdfRes.ok) {
      throw new AppError(
        pdfRes.status === 404
          ? "Invoice PDF not ready yet. Try again shortly."
          : "Failed to fetch invoice PDF.",
        pdfRes.status === 404 ? 404 : 502,
        "invoice_pdf_error",
      );
    }

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
