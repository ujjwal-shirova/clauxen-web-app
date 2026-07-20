import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  billingWorkerRazorpay,
  isBillingWorkerConfigured,
} from "@/backend/billing/billing-worker";
import { env } from "@/backend/config/env";
import { AppError } from "@/backend/db/errors"; // typed HTTP errors — billing_unavailable, razorpay_error codes

export function isRazorpayConfigured() {
  // Prefer Cloudflare billing Worker (keys live on CF). Fall back to Vercel keys.
  return (
    isBillingWorkerConfigured() ||
    Boolean(env.razorpayKeyId && env.razorpayKeySecret)
  );
}

const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{8,40}$/;

function razorpayAuthHeader(): string {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`;
}

async function razorpayApiDirect<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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

/**
 * All Razorpay REST calls prefer Cloudflare billing Worker when configured
 * (server-side only — secrets never touch the browser). Falls back to direct
 * Razorpay from Vercel if the Worker is unreachable or missing keys (503).
 */
async function razorpayApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (isBillingWorkerConfigured()) {
    try {
      const method = (init?.method ?? "GET").toUpperCase();
      let workerPath: string | null = null;
      if (path === "/v1/orders" && method === "POST") {
        workerPath = "/v1/razorpay/orders";
      } else if (path === "/v1/payments/qr_codes" && method === "POST") {
        workerPath = "/v1/razorpay/upi-qr";
      } else {
        const pay = path.match(/^\/v1\/payments\/([^/?]+)$/);
        if (pay && method === "GET") {
          workerPath = `/v1/razorpay/payments/${pay[1]}`;
        }
        const order = path.match(/^\/v1\/orders\/([^/?]+)$/);
        if (order && method === "GET") {
          workerPath = `/v1/razorpay/orders/${order[1]}`;
        }
        const qr = path.match(/^\/v1\/payments\/qr_codes\/([^/?]+)$/);
        if (qr && method === "GET") {
          workerPath = `/v1/razorpay/qr/${qr[1]}`;
        }
        const qrPay = path.match(/^\/v1\/payments\/qr_codes\/([^/?]+)\/payments/);
        if (qrPay && method === "GET") {
          workerPath = `/v1/razorpay/qr/${qrPay[1]}/payments`;
        }
        const qrClose = path.match(/^\/v1\/payments\/qr_codes\/([^/?]+)\/close$/);
        if (qrClose && method === "POST") {
          workerPath = `/v1/razorpay/qr/${qrClose[1]}/close`;
        }
      }

      if (workerPath) {
        return await billingWorkerRazorpay<T>(workerPath, init);
      }
    } catch (err) {
      // Worker missing secrets / down — fall through to Vercel Razorpay keys.
      if (
        !(err instanceof AppError) ||
        (err.status !== 503 && err.code !== "billing_unavailable")
      ) {
        // Still try direct if local keys exist
        if (!env.razorpayKeyId || !env.razorpayKeySecret) throw err;
      }
    }
  }

  return razorpayApiDirect<T>(path, init);
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
  /** Skip Cloudflare Worker hop when Vercel holds Razorpay keys. */
  preferDirect?: boolean;
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

  const body = JSON.stringify({
    amount,
    currency,
    receipt: input.receipt,
    notes: input.notes ?? {},
  });

  if (input.preferDirect && env.razorpayKeyId && env.razorpayKeySecret) {
    return razorpayApiDirect<{
      id: string;
      amount: number;
      currency: string;
      receipt: string;
    }>("/v1/orders", { method: "POST", body });
  }

  return razorpayApi<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
  }>("/v1/orders", {
    method: "POST",
    body,
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
//
// Docs: https://razorpay.com/docs/webhooks/  (and integration best practices)
// Always use timingSafeEqual and reject early on mismatch to avoid timing attacks.
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
  /** Native UPI intent string — same payload Checkout encodes in its QR. */
  image_content?: string | null;
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
  /** Skip Cloudflare Worker hop — call Razorpay directly for lower latency. */
  preferDirect?: boolean;
}): Promise<RazorpayQrCodeEntity> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError("Invalid QR payment amount.", 400, "bad_request");
  }

  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    // Fall through to worker-backed path when only CF holds keys.
    if (!isBillingWorkerConfigured()) {
      throw new AppError(
        "Razorpay is not configured.",
        503,
        "billing_unavailable",
      );
    }
  }

  const closeBy =
    Math.floor(Date.now() / 1000) + (input.closeBySeconds ?? 20 * 60);

  const body = JSON.stringify({
    type: "upi_qr",
    name: "shirova", // Razorpay QR merchant slug (lowercase); UI copy uses Shirova
    usage: "single_use",
    fixed_amount: true,
    payment_amount: input.amountPaise,
    description: input.description.slice(0, 255),
    close_by: closeBy,
    notes: input.notes ?? {},
  });

  const qr =
    input.preferDirect && env.razorpayKeyId && env.razorpayKeySecret
      ? await razorpayApiDirect<RazorpayQrCodeEntity>(
          "/v1/payments/qr_codes",
          { method: "POST", body },
        )
      : await razorpayApi<RazorpayQrCodeEntity>("/v1/payments/qr_codes", {
          method: "POST",
          body,
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

  if (env.razorpayKeyId && env.razorpayKeySecret) {
    return razorpayApiDirect<RazorpayQrCodeEntity>(
      `/v1/payments/qr_codes/${qrId}`,
    );
  }

  return razorpayApi<RazorpayQrCodeEntity>(`/v1/payments/qr_codes/${qrId}`);
}

export type RazorpayPaymentLinkEntity = {
  id: string;
  short_url: string;
  status: string;
  amount: number;
  amount_paid?: number;
  upi_link?: boolean;
  payments?: Array<{
    payment_id?: string;
    amount?: number;
    status?: string;
    method?: string;
    order_id?: string;
  }> | null;
};

/** UPI payment link — used when QR Codes API is not enabled on the merchant. */
export async function createRazorpayUpiPaymentLink(input: {
  amountPaise: number;
  description: string;
  customerName?: string;
  customerEmail?: string;
  notes?: Record<string, string>;
  expireBySeconds?: number;
}): Promise<RazorpayPaymentLinkEntity> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError("Invalid payment link amount.", 400, "bad_request");
  }

  const expireBy =
    Math.floor(Date.now() / 1000) + (input.expireBySeconds ?? 20 * 60);

  const body = JSON.stringify({
    amount: input.amountPaise,
    currency: "INR",
    accept_partial: false,
    description: input.description.slice(0, 255),
    upi_link: true,
    expire_by: expireBy,
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: input.notes ?? {},
    customer: {
      ...(input.customerName ? { name: input.customerName.slice(0, 100) } : {}),
      ...(input.customerEmail
        ? { email: input.customerEmail.slice(0, 100) }
        : {}),
    },
  });

  // Payment Links are not proxied on the Worker yet — call Razorpay directly.
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError(
      "Razorpay keys are required for UPI payment links.",
      503,
      "billing_unavailable",
    );
  }

  const link = await razorpayApiDirect<RazorpayPaymentLinkEntity>(
    "/v1/payment_links",
    { method: "POST", body },
  );

  if (!link?.id || !link.short_url) {
    throw new AppError(
      "Invalid Razorpay payment link response.",
      502,
      "razorpay_error",
    );
  }

  return link;
}

export async function fetchRazorpayPaymentLink(
  linkId: string,
): Promise<RazorpayPaymentLinkEntity> {
  if (!/^plink_[A-Za-z0-9]{8,40}$/.test(linkId)) {
    throw new AppError("Invalid payment link id.", 400, "bad_request");
  }
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return razorpayApiDirect<RazorpayPaymentLinkEntity>(
    `/v1/payment_links/${linkId}`,
  );
}

/** PNG buffer for embedding a UPI / payment-link URL as a QR code. */
export async function renderPaymentQrPng(
  payload: string,
): Promise<Buffer> {
  const QRCode = await import("qrcode");
  // High-res square for phone cameras; payload string is unchanged.
  return QRCode.toBuffer(payload, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111827", light: "#ffffff" },
  });
}

type JsQRDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => { data: string } | null;

function resolveJsQRDecoder(mod: unknown): JsQRDecoder {
  if (typeof mod === "function") return mod as JsQRDecoder;
  if (mod && typeof mod === "object") {
    const record = mod as { default?: unknown; jsQR?: unknown };
    if (typeof record.default === "function") {
      return record.default as JsQRDecoder;
    }
    if (typeof record.jsQR === "function") {
      return record.jsQR as JsQRDecoder;
    }
  }
  throw new Error("jsQR module did not export a decoder function");
}

function toNodeBuffer(bytes: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof ArrayBuffer) return Buffer.from(new Uint8Array(bytes));
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Razorpay’s `image_url` is a branded marketing card (Powered by Razorpay / BHIM
 * chrome). Decode that PNG to recover the native `upi://` intent, then we render
 * a clean square QR for the checkout modal — payload bytes are never rewritten.
 */
export async function decodeUpiIntentFromQrPng(
  pngBytes: Buffer | ArrayBuffer | Uint8Array,
): Promise<string | null> {
  const [{ PNG }, jsQRMod] = await Promise.all([
    import("pngjs"),
    import("jsqr"),
  ]);
  const decode = resolveJsQRDecoder(jsQRMod);
  const buf = toNodeBuffer(pngBytes);

  // Razorpay serves PNG; reject non-PNG early so we never mis-decode.
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
    return null;
  }

  let png: { width: number; height: number; data: Buffer };
  try {
    png = PNG.sync.read(buf);
  } catch {
    return null;
  }

  const rgba = new Uint8ClampedArray(
    png.data.buffer,
    png.data.byteOffset,
    png.data.byteLength,
  );

  const tryDecode = (data: Uint8ClampedArray, width: number, height: number) => {
    const code = decode(data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    const text = code?.data?.trim();
    return text && /^upi:\/\//i.test(text) ? text : null;
  };

  // 1) Full branded card (674×1644 in practice) — jsQR usually finds the square.
  const full = tryDecode(rgba, png.width, png.height);
  if (full) return full;

  // 2) Center crop fallback — QR sits in the middle of Razorpay’s tall card.
  if (png.width >= 80 && png.height >= 80) {
    const side = Math.min(png.width, png.height);
    const x0 = Math.floor((png.width - side) / 2);
    const y0 = Math.floor((png.height - side) / 2);
    const cropped = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y += 1) {
      const src = ((y0 + y) * png.width + x0) * 4;
      cropped.set(rgba.subarray(src, src + side * 4), y * side * 4);
    }
    const center = tryDecode(cropped, side, side);
    if (center) return center;
  }

  return null;
}

export async function fetchRazorpayQrImageBytes(
  imageUrl: string,
): Promise<{ bytes: Buffer; contentType: string }> {
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
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}

/**
 * Resolve native UPI intent for a Razorpay QR entity.
 * Prefer `image_content`; otherwise decode Razorpay’s branded `image_url` PNG.
 */
export async function resolveUpiQrIntent(
  qr: Pick<RazorpayQrCodeEntity, "image_content" | "image_url">,
): Promise<string> {
  const direct = qr.image_content?.trim();
  if (direct && /^upi:\/\//i.test(direct)) return direct;

  const imageUrl = qr.image_url?.trim();
  if (!imageUrl) {
    throw new AppError("QR image unavailable.", 502, "razorpay_error");
  }

  const { bytes, contentType } = await fetchRazorpayQrImageBytes(imageUrl);
  if (!contentType.startsWith("image/")) {
    // Rare: image_url is already an intent/URL page — if it's upi, use it.
    if (/^upi:\/\//i.test(imageUrl)) return imageUrl;
    throw new AppError("QR image unavailable.", 502, "razorpay_error");
  }

  const intent = await decodeUpiIntentFromQrPng(bytes);
  if (!intent) {
    throw new AppError(
      "Could not decode UPI QR intent from Razorpay image.",
      502,
      "razorpay_error",
    );
  }
  return intent;
}

/** Clean square PNG (data URL) for the custom UPI modal — never Razorpay’s branded card. */
export async function renderCleanUpiQrDataUrl(intent: string): Promise<string> {
  const png = await renderPaymentQrPng(intent);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function fetchRazorpayQrPayments(qrId: string) {
  if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
    throw new AppError("Invalid QR id.", 400, "bad_request");
  }

  if (env.razorpayKeyId && env.razorpayKeySecret) {
    return razorpayApiDirect<{
      items: Array<{
        id: string;
        amount: number;
        status: string;
        method?: string;
        order_id?: string;
      }>;
    }>(`/v1/payments/qr_codes/${qrId}/payments?count=5`);
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

export async function closeRazorpayQrCode(qrId: string) {
  if (!/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
    throw new AppError("Invalid QR id.", 400, "bad_request");
  }

  return razorpayApi<RazorpayQrCodeEntity>(
    `/v1/payments/qr_codes/${qrId}/close`,
    { method: "POST", body: "{}" },
  );
}

// client-side checkout success signature verify — orderId|paymentId HMAC with key secret
//
// Razorpay requirement (from https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/ ):
//   generated_signature = hmac_sha256(order_id + "|" + razorpay_payment_id, secret)
// You MUST verify on YOUR server using YOUR secret before any fulfillment.
// If it does not match, treat as fraud / tampering.
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

/** Prefers Cloudflare billing Worker when local Razorpay secret is absent. */
export async function verifyPaymentSignatureSecure(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  if (env.razorpayKeySecret) {
    return verifyPaymentSignature(input);
  }
  if (!isBillingWorkerConfigured()) return false;
  try {
    const res = await billingWorkerRazorpay<{ valid?: boolean }>(
      "/v1/razorpay/verify-signature",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return Boolean(res.valid);
  } catch {
    return false;
  }
}
