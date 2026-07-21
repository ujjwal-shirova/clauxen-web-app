import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/backend/auth/session";
import { AppError } from "@/backend/db/errors";
import { queryOne } from "@/backend/db/pool";
import * as billingService from "@/backend/services/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_SIGNATURE_RE = /^[a-f0-9]{64}$/i;

/**
 * Same-origin relative path only — blocks open redirects via callback ?return=.
 */
function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/new";
  }
  // Disallow protocol-relative and backslash tricks.
  if (raw.includes("\\") || raw.includes("@")) {
    return "/new";
  }
  return raw.slice(0, 512);
}

function redirectWithCheckout(
  request: NextRequest,
  returnPath: string,
  status: "success" | "failed" | "error",
) {
  const url = new URL(returnPath, request.url);
  url.searchParams.set("checkout", status);
  return NextResponse.redirect(url, 303);
}

/**
 * Razorpay Custom Checkout redirect callback for netbanking.
 * Browser POSTs here after bank auth (no popup). Verifies signature and fulfills.
 *
 * @see https://razorpay.com/docs/payments/payment-gateway/callback-url/
 */
export async function POST(request: NextRequest) {
  const returnPath = safeReturnPath(request.nextUrl.searchParams.get("return"));

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return redirectWithCheckout(request, "/login", "error");
    }

    const contentType = request.headers.get("content-type") ?? "";
    let razorpayOrderId = "";
    let razorpayPaymentId = "";
    let razorpaySignature = "";
    let errorDescription = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      razorpayOrderId = String(body.razorpay_order_id ?? "");
      razorpayPaymentId = String(body.razorpay_payment_id ?? "");
      razorpaySignature = String(body.razorpay_signature ?? "");
      const err = body.error as { description?: string } | undefined;
      errorDescription = err?.description ? String(err.description) : "";
    } else {
      const form = await request.formData();
      razorpayOrderId = String(form.get("razorpay_order_id") ?? "");
      razorpayPaymentId = String(form.get("razorpay_payment_id") ?? "");
      razorpaySignature = String(form.get("razorpay_signature") ?? "");
      errorDescription = String(
        form.get("error[description]") ?? form.get("error_description") ?? "",
      );
    }

    if (errorDescription || !razorpayPaymentId) {
      return redirectWithCheckout(request, returnPath, "failed");
    }

    if (
      !RAZORPAY_ORDER_ID_RE.test(razorpayOrderId) ||
      !RAZORPAY_PAYMENT_ID_RE.test(razorpayPaymentId) ||
      !RAZORPAY_SIGNATURE_RE.test(razorpaySignature)
    ) {
      return redirectWithCheckout(request, returnPath, "error");
    }

    const order = await queryOne<{ user_id: string }>(
      `select user_id from public.billing_orders where razorpay_order_id = $1 limit 1`,
      [razorpayOrderId],
    );
    if (!order || order.user_id !== session.id) {
      return redirectWithCheckout(request, returnPath, "error");
    }

    await billingService.verifyCheckoutPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return redirectWithCheckout(request, returnPath, "success");
  } catch (error) {
    console.error(
      "[billing] razorpay netbanking callback failed",
      error instanceof AppError ? error.message : error,
    );
    return redirectWithCheckout(request, returnPath, "error");
  }
}
