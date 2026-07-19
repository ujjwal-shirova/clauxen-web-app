import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import {
  fetchRazorpayPaymentLink,
  fetchRazorpayQrCode,
  renderPaymentQrPng,
} from "@/backend/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin QR image for the custom UPI modal.
 *
 * - qr_* + image_content (upi://…) → render PNG of the native UPI intent
 *   (same payload Razorpay Checkout encodes — pays into the live merchant).
 * - qr_* + image_url only → proxy Razorpay’s QR image (or render URL if HTML).
 * - plink_* → render PNG of the live UPI payment-link short_url (real money;
 *   used only when QR Codes product is not enabled on the account).
 */
export const GET = withApiRouteParams<{ qrId: string }>(
  async ({ session, params }) => {
    requireSession(session);
    const qrId = params.qrId;

    if (/^plink_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      const link = await fetchRazorpayPaymentLink(qrId);
      if (!link.short_url) {
        throw new AppError("Payment link QR unavailable.", 502, "razorpay_error");
      }
      const png = await renderPaymentQrPng(link.short_url);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      throw new AppError("Invalid QR id.", 400, "bad_request");
    }

    const qr = await fetchRazorpayQrCode(qrId);

    // Prefer native UPI intent — this is what Checkout’s QR encodes.
    const intent = qr.image_content?.trim();
    if (intent && /^upi:\/\//i.test(intent)) {
      const png = await renderPaymentQrPng(intent);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const imageUrl = qr.image_url?.trim();
    if (!imageUrl) {
      throw new AppError("QR image unavailable.", 502, "razorpay_error");
    }

    const upstream = imageUrl.startsWith("http://")
      ? `https://${imageUrl.slice("http://".length)}`
      : imageUrl;

    const res = await fetch(upstream, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*",
        "User-Agent": "ClauxenBilling/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new AppError("Could not load UPI QR image.", 502, "razorpay_error");
    }

    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      const png = await renderPaymentQrPng(upstream);
      return new Response(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const bytes = await res.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
  { requireAuth: true },
);
