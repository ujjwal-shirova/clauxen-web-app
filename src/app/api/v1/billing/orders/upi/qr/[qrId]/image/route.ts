import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { AppError, notFound } from "@/backend/db/errors";
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

async function ownedOrderForQr(qrId: string, userId: string) {
  const order = await billingRepo.getBillingOrderByUpiQrId(qrId);
  if (!order || order.user_id !== userId) {
    throw notFound("QR code not found.");
  }
  return order;
}

function rememberUpiIntent(qrId: string, intent: string) {
  // Best-effort cache so later polls skip Razorpay fetch + decode.
  void billingRepo
    .mergeBillingOrderMetadataByUpiQrId(qrId, { upiIntent: intent })
    .catch(() => undefined);
}

/**
 * Same-origin clean UPI QR image for the custom modal.
 *
 * Never proxies Razorpay’s branded marketing card. Always renders a square PNG
 * from the native `upi://` intent (or payment-link URL as last-resort fallback).
 * Ownership: only the billing order owner may fetch the image.
 */
export const GET = withApiRouteParams<{ qrId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const qrId = params.qrId;

    if (/^plink_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      const order = await ownedOrderForQr(qrId, user.id);
      const saved =
        typeof order.metadata?.upiIntent === "string"
          ? order.metadata.upiIntent.trim()
          : "";
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
      if (!saved) rememberUpiIntent(qrId, intent);
      return pngResponse(await renderPaymentQrPng(intent), "private, no-store");
    }

    if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      throw new AppError("Invalid QR id.", 400, "bad_request");
    }

    const order = await ownedOrderForQr(qrId, user.id);
    const saved =
      typeof order.metadata?.upiIntent === "string"
        ? order.metadata.upiIntent.trim()
        : "";
    if (saved && /^upi:\/\//i.test(saved)) {
      return pngResponse(
        await renderPaymentQrPng(saved),
        "private, max-age=120",
      );
    }

    const qr = await fetchRazorpayQrCode(qrId);
    const intent = await resolveUpiQrIntent(qr);
    rememberUpiIntent(qrId, intent);
    return pngResponse(
      await renderPaymentQrPng(intent),
      "private, max-age=120",
    );
  },
  { requireAuth: true },
);
