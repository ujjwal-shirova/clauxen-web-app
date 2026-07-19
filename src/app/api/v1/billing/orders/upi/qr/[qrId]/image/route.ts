import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import {
  fetchRazorpayPaymentLink,
  fetchRazorpayQrCode,
  renderPaymentQrPng,
  resolveUpiQrIntent,
} from "@/backend/billing/razorpay";
import * as billingRepo from "@/backend/repositories/billing.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pngResponse(png: Buffer, cacheControl: string) {
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function savedUpiIntent(qrId: string): Promise<string | null> {
  const order = await billingRepo.getBillingOrderByUpiQrId(qrId);
  const intent = order?.metadata?.upiIntent;
  return typeof intent === "string" && intent.trim() ? intent.trim() : null;
}

/**
 * Same-origin clean UPI QR image for the custom modal.
 *
 * Never proxies Razorpay’s branded marketing card. Always renders a square PNG
 * from the native `upi://` intent (or payment-link URL as last-resort fallback).
 */
export const GET = withApiRouteParams<{ qrId: string }>(
  async ({ session, params }) => {
    requireSession(session);
    const qrId = params.qrId;

    if (/^plink_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      const saved = await savedUpiIntent(qrId);
      const intent =
        saved ||
        (await fetchRazorpayPaymentLink(qrId)).short_url ||
        null;
      if (!intent) {
        throw new AppError(
          "Payment link QR unavailable.",
          502,
          "razorpay_error",
        );
      }
      return pngResponse(await renderPaymentQrPng(intent), "private, no-store");
    }

    if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      throw new AppError("Invalid QR id.", 400, "bad_request");
    }

    const saved = await savedUpiIntent(qrId);
    if (saved && /^upi:\/\//i.test(saved)) {
      return pngResponse(
        await renderPaymentQrPng(saved),
        "private, max-age=120",
      );
    }

    const qr = await fetchRazorpayQrCode(qrId);
    const intent = await resolveUpiQrIntent(qr);
    return pngResponse(
      await renderPaymentQrPng(intent),
      "private, max-age=120",
    );
  },
  { requireAuth: true },
);
