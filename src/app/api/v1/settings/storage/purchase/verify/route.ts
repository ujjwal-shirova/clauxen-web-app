import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as storageAddons from "@/server/services/storage-addons.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_RE = /^order_[A-Za-z0-9]{8,40}$/;
const PAYMENT_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => null)) as {
      purchaseId?: unknown;
      razorpayOrderId?: unknown;
      razorpayPaymentId?: unknown;
      razorpaySignature?: unknown;
    } | null;

    const purchaseId = typeof body?.purchaseId === "string" ? body.purchaseId : "";
    const razorpayOrderId =
      typeof body?.razorpayOrderId === "string" ? body.razorpayOrderId : "";
    const razorpayPaymentId =
      typeof body?.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
    const razorpaySignature =
      typeof body?.razorpaySignature === "string" ? body.razorpaySignature : "";

    if (
      !UUID_RE.test(purchaseId) ||
      !ORDER_RE.test(razorpayOrderId) ||
      !PAYMENT_RE.test(razorpayPaymentId) ||
      razorpaySignature.length < 8 ||
      razorpaySignature.length > 128
    ) {
      throw new AppError("Invalid payment confirmation.", 400, "bad_request");
    }

    const result = await storageAddons.verifyStoragePurchase({
      userId: user.id,
      purchaseId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
