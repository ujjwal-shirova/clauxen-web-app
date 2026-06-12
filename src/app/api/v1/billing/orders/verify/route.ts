import { withApiHandler } from "@/backend/http/api-handler"; // session-aware handler wrapper
import { jsonData } from "@/backend/http/api-response"; // standardized JSON envelope
import { requireSession } from "@/backend/auth/require-session";
import * as billingService from "@/backend/services/billing.service"; // signature check + DB fulfillment
import { AppError } from "@/backend/db/errors"; // validation failures → 400 response
import { queryOne } from "@/backend/db/pool"; // ownership check — order belongs to session user

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Razorpay id shapes — reject oversized/malformed input before HMAC + DB fulfill
const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_SIGNATURE_RE = /^[a-f0-9]{64}$/i;

function assertRazorpayCheckoutIds(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  if (
    !RAZORPAY_ORDER_ID_RE.test(input.razorpayOrderId) ||
    !RAZORPAY_PAYMENT_ID_RE.test(input.razorpayPaymentId) ||
    !RAZORPAY_SIGNATURE_RE.test(input.razorpaySignature)
  ) {
    throw new AppError(
      "Invalid Razorpay payment identifiers.",
      400,
      "bad_request",
    );
  }
}

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session); // session owner — order row must match user.id (IDOR guard)
    const body = (await request.json()) as {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    if (
      !body.razorpayOrderId ||
      !body.razorpayPaymentId ||
      !body.razorpaySignature
    ) {
      throw new AppError(
        "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.",
        400,
      );
    }

    assertRazorpayCheckoutIds({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });

    const order = await queryOne<{ user_id: string }>(
      `select user_id from public.billing_orders where razorpay_order_id = $1 limit 1`,
      [body.razorpayOrderId],
    );
    if (!order || order.user_id !== user.id) {
      // generic 404 — do not reveal whether order exists for another user
      throw new AppError("Order not found.", 404, "not_found");
    }

    const result = await billingService.verifyCheckoutPayment({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });

    return jsonData({ fulfillment: result });
  },
  { requireAuth: true },
);
