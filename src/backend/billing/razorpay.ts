import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { env } from "@/backend/config/env";
import { AppError } from "@/backend/db/errors"; // typed HTTP errors — billing_unavailable, razorpay_error codes

export function isRazorpayConfigured() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{8,40}$/;

function razorpayAuthHeader(): string {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`;
}

async function razorpayApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(
      (body as { error?: { description?: string } })?.error?.description ||
        "Razorpay API request failed.",
      502,
      "razorpay_error",
    );
  }
  return body as T;
}

// HMAC hex digest compare — timing-safe to avoid signature oracle via early exit
function secureCompareHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(actual, "utf8"),
    );
  } catch {
    return false;
  }
}

export async function createRazorpayOrder(input: {
  /** Charge amount in minor units (INR paise or USD cents). */
  amountMinor: number;
  amountPaise?: number;
  currency?: string; // ISO currency — default INR
  receipt: string;
  notes?: Record<string, string>;
}) {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }

  const currency = input.currency ?? "INR";
  const amount =
    input.amountMinor ??
    input.amountPaise ??
    (() => {
      throw new AppError("Order amount is required.", 400, "bad_request");
    })();

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("Invalid order amount.", 400, "bad_request");
  }

  return razorpayApi<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
  }>("/v1/orders", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
}

export type RazorpayPaymentEntity = {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method?: string;
  email?: string;
  contact?: string;
  captured: boolean;
  notes?: Record<string, string> | string[];
};

/** Server-side payment fetch — verify amount/order before fulfillment. */
export async function fetchRazorpayPayment(
  paymentId: string,
): Promise<RazorpayPaymentEntity> {
  if (!RAZORPAY_PAYMENT_ID_RE.test(paymentId)) {
    throw new AppError("Invalid payment id.", 400, "bad_request");
  }

  const payment = await razorpayApi<RazorpayPaymentEntity>(
    `/v1/payments/${paymentId}`,
  );

  if (!payment?.id || payment.entity !== "payment") {
    throw new AppError("Invalid Razorpay payment response.", 502, "razorpay_error");
  }

  return payment;
}

export async function fetchRazorpayOrder(orderId: string) {
  if (!RAZORPAY_ORDER_ID_RE.test(orderId)) {
    throw new AppError("Invalid order id.", 400, "bad_request");
  }

  return razorpayApi<{
    id: string;
    amount: number;
    currency: string;
    status: string;
  }>(`/v1/orders/${orderId}`);
}

// Razorpay webhook payload authenticity verify — HMAC-SHA256(rawBody, webhookSecret) === signature header
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
) {
  if (!env.razorpayWebhookSecret || !signature) return false;
  const expected = createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex"); // hex digest — Razorpay X-Razorpay-Signature format
  return secureCompareHex(expected, signature);
}

export function newOrderId() {
  return `ord_${randomUUID().replace(/-/g, "")}`;
}

// Razorpay receipt field — timestamp-based short unique string
export function newReceipt() {
  return `rcpt_${Date.now()}`;
}

export type RazorpayQrCodeEntity = {
  id: string;
  entity: string;
  image_url: string;
  status: string;
  payment_amount: number;
  payments_amount_received: number;
  payments_count_received: number;
  close_by?: number;
};

/** Single-use UPI QR — amount fixed server-side; works with any UPI app. */
export async function createRazorpayUpiQr(input: {
  amountPaise: number;
  description: string;
  notes?: Record<string, string>;
  closeBySeconds?: number;
}): Promise<RazorpayQrCodeEntity> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError("Invalid QR payment amount.", 400, "bad_request");
  }

  const closeBy =
    Math.floor(Date.now() / 1000) + (input.closeBySeconds ?? 15 * 60);

  const qr = await razorpayApi<RazorpayQrCodeEntity>("/v1/payments/qr_codes", {
    method: "POST",
    body: JSON.stringify({
      type: "upi_qr",
      name: "Clauxen Checkout",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: input.amountPaise,
      description: input.description.slice(0, 255),
      close_by: closeBy,
      notes: input.notes ?? {},
    }),
  });

  if (!qr?.id || !qr.image_url) {
    throw new AppError("Invalid Razorpay QR response.", 502, "razorpay_error");
  }

  return qr;
}

export async function fetchRazorpayQrCode(
  qrId: string,
): Promise<RazorpayQrCodeEntity> {
  if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
    throw new AppError("Invalid QR id.", 400, "bad_request");
  }

  return razorpayApi<RazorpayQrCodeEntity>(`/v1/payments/qr_codes/${qrId}`);
}

export async function fetchRazorpayQrPayments(qrId: string) {
  if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
    throw new AppError("Invalid QR id.", 400, "bad_request");
  }

  return razorpayApi<{
    items: Array<{
      id: string;
      amount: number;
      status: string;
      method?: string;
      order_id?: string;
    }>;
  }>(`/v1/payments/qr_codes/${qrId}/payments?count=5`);
}

// client-side checkout success signature verify — orderId|paymentId HMAC with key secret
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!env.razorpayKeySecret) return false; // secret missing — verification impossible
  const expected = createHmac("sha256", env.razorpayKeySecret)
    .update(`${input.orderId}|${input.paymentId}`) // Razorpay documented pipe-separated payload
    .digest("hex");
  return secureCompareHex(expected, input.signature);
}
