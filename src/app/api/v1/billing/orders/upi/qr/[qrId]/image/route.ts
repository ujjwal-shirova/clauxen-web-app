import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import { fetchRazorpayQrCode } from "@/backend/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin proxy for Razorpay UPI QR images.
 * Direct rzp.io <img> loads are often blocked in-browser; proxy keeps QR visible.
 */
export const GET = withApiRouteParams<{ qrId: string }>(
  async ({ session, params }) => {
    requireSession(session);
    const qrId = params.qrId;
    if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      throw new AppError("Invalid QR id.", 400, "bad_request");
    }

    const qr = await fetchRazorpayQrCode(qrId);
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
      throw new AppError("Invalid UPI QR image response.", 502, "razorpay_error");
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
