import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as billingProfile from "@/server/services/billing-profile.service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_RE = /^order_[A-Za-z0-9]{8,40}$/;
const PAY_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const SIG_RE = /^[a-f0-9]{64}$/i;

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      method?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      cardFirst4?: string;
      upiVpa?: string;
      customerId?: string;
    };

    const method = body.method === "upi" ? "upi" : body.method === "card" ? "card" : null;
    if (!method) {
      throw new AppError('method must be "card" or "upi".', 400, "bad_request");
    }
    if (
      !body.razorpayOrderId ||
      !body.razorpayPaymentId ||
      !body.razorpaySignature ||
      !ORDER_RE.test(body.razorpayOrderId) ||
      !PAY_RE.test(body.razorpayPaymentId) ||
      !SIG_RE.test(body.razorpaySignature)
    ) {
      throw new AppError("Invalid Razorpay payment identifiers.", 400, "bad_request");
    }

    const paymentMethod = await billingProfile.verifyPaymentMethodSetup({
      userId: user.id,
      method,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
      cardFirst4: body.cardFirst4,
      upiVpa: body.upiVpa,
      customerId: body.customerId,
    });

    return jsonData({ paymentMethod });
  },
  { requireAuth: true },
);
