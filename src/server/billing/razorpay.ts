import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  billingWorkerRazorpay,
  isBillingWorkerConfigured,
} from "@/server/billing/billing-worker";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors"; // typed HTTP errors — billing_unavailable, razorpay_error codes

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
        const payCapture = path.match(/^\/v1\/payments\/([^/?]+)\/capture$/);
        if (payCapture && method === "POST") {
          workerPath = `/v1/razorpay/payments/${payCapture[1]}/capture`;
        }
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
    // Auto-capture on auth so checkout verify isn't stuck on "authorized".
    payment_capture: 1,
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

export type RazorpayPaymentCard = {
  id?: string;
  entity?: string;
  name?: string;
  last4?: string;
  network?: string;
  type?: string;
  issuer?: string;
  international?: boolean;
  emi?: boolean;
  expiry_month?: number;
  expiry_year?: number;
};

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
  /** Present on card payments when Razorpay returns card details. */
  card?: RazorpayPaymentCard | null;
  token_id?: string | null;
  card_id?: string | null;
};

/** Server-side payment fetch — verify amount/order before fulfillment. */
export async function fetchRazorpayPayment(
  paymentId: string,
): Promise<RazorpayPaymentEntity> {
  if (!RAZORPAY_PAYMENT_ID_RE.test(paymentId)) {
    throw new AppError("Invalid payment id.", 400, "bad_request");
  }

  // Expand card so we can persist last4/network for card-on-file (never PAN).
  const payment = await razorpayApi<RazorpayPaymentEntity>(
    `/v1/payments/${paymentId}?expand[]=card`,
  );

  if (!payment?.id || payment.entity !== "payment") {
    throw new AppError("Invalid Razorpay payment response.", 502, "razorpay_error");
  }

  // Normalize card_id onto card object when Razorpay returns it at top level.
  if (!payment.card?.id && payment.card_id) {
    payment.card = { ...(payment.card ?? {}), id: payment.card_id };
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

/** Capture an authorized payment (direct keys preferred — Worker has no capture route yet). */
export async function captureRazorpayPayment(input: {
  paymentId: string;
  amount: number;
  currency: string;
}): Promise<RazorpayPaymentEntity> {
  if (!RAZORPAY_PAYMENT_ID_RE.test(input.paymentId)) {
    throw new AppError("Invalid payment id.", 400, "bad_request");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError("Invalid capture amount.", 400, "bad_request");
  }

  const body = JSON.stringify({
    amount: input.amount,
    currency: input.currency.toUpperCase(),
  });

  // Prefer Vercel keys so we don't depend on Worker path coverage.
  if (env.razorpayKeyId && env.razorpayKeySecret) {
    return razorpayApiDirect<RazorpayPaymentEntity>(
      `/v1/payments/${input.paymentId}/capture`,
      { method: "POST", body },
    );
  }

  return razorpayApi<RazorpayPaymentEntity>(
    `/v1/payments/${input.paymentId}/capture`,
    { method: "POST", body },
  );
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
  customerContact?: string;
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
      ...(input.customerContact
        ? { contact: input.customerContact.slice(0, 20) }
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

/** Display-sized QR PNG — modal is ~168–220px; avoid expensive 512px upscale. */
const CLEAN_QR_RENDER_WIDTH = 256;

/** jsQR scan size after center-crop — enough modules, far fewer pixels than the tall card. */
const UPI_QR_SCAN_SIZE = 280;

/** PNG buffer for embedding a UPI / payment-link URL as a QR code. */
export async function renderPaymentQrPng(
  payload: string,
): Promise<Buffer> {
  const QRCode = await import("qrcode");
  // Payload string is unchanged; keep width at display size for speed.
  return QRCode.toBuffer(payload, {
    type: "png",
    width: CLEAN_QR_RENDER_WIDTH,
    margin: 1,
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

function upiIntentFromJsQR(
  decode: JsQRDecoder,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  // Dark-on-light first (typical UPI QR) — skip costly invert pass unless needed.
  for (const inversionAttempts of ["dontInvert", "attemptBoth"] as const) {
    const code = decode(data, width, height, { inversionAttempts });
    const text = code?.data?.trim();
    if (text && /^upi:\/\//i.test(text)) return text;
  }
  return null;
}

/**
 * Fast path: center-crop the tall Razorpay marketing card, shrink for jsQR.
 * Never scan the full ~674×1644 bitmap (that was the multi-second bottleneck).
 */
async function decodeUpiIntentWithSharp(
  buf: Buffer,
  decode: JsQRDecoder,
): Promise<string | null> {
  const sharpMod = await import("sharp");
  const sharp = sharpMod.default;
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 80 || height < 80) return null;

  const side = Math.min(width, height);
  const crops = [
    {
      left: Math.floor((width - side) / 2),
      top: Math.floor((height - side) / 2),
      width: side,
      height: side,
    },
    {
      left: Math.floor((width - Math.floor(side * 0.72)) / 2),
      top: Math.floor((height - Math.floor(side * 0.72)) / 2),
      width: Math.floor(side * 0.72),
      height: Math.floor(side * 0.72),
    },
  ];

  for (const region of crops) {
    if (region.width < 80 || region.height < 80) continue;
    const scan = Math.min(UPI_QR_SCAN_SIZE, region.width, region.height);
    const { data, info } = await sharp(buf, { failOn: "none" })
      .extract(region)
      .resize(scan, scan, { kernel: "nearest", fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgba = new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    const intent = upiIntentFromJsQR(decode, rgba, info.width, info.height);
    if (intent) return intent;
  }
  return null;
}

/** Fallback when sharp is unavailable — crop-first with pngjs, never full-frame scan. */
async function decodeUpiIntentWithPngjs(
  buf: Buffer,
  decode: JsQRDecoder,
): Promise<string | null> {
  const { PNG } = await import("pngjs");
  let png: { width: number; height: number; data: Buffer };
  try {
    png = PNG.sync.read(buf);
  } catch {
    return null;
  }
  if (png.width < 80 || png.height < 80) return null;

  const rgba = new Uint8ClampedArray(
    png.data.buffer,
    png.data.byteOffset,
    png.data.byteLength,
  );
  const side = Math.min(png.width, png.height);
  const ratios = [1, 0.72] as const;

  for (const ratio of ratios) {
    const cropSide = Math.floor(side * ratio);
    if (cropSide < 80) continue;
    const x0 = Math.floor((png.width - cropSide) / 2);
    const y0 = Math.floor((png.height - cropSide) / 2);
    const cropped = new Uint8ClampedArray(cropSide * cropSide * 4);
    for (let y = 0; y < cropSide; y += 1) {
      const src = ((y0 + y) * png.width + x0) * 4;
      cropped.set(rgba.subarray(src, src + cropSide * 4), y * cropSide * 4);
    }

    const scan = Math.min(UPI_QR_SCAN_SIZE, cropSide);
    if (scan === cropSide) {
      const intent = upiIntentFromJsQR(decode, cropped, cropSide, cropSide);
      if (intent) return intent;
      continue;
    }
    const scaled = new Uint8ClampedArray(scan * scan * 4);
    for (let y = 0; y < scan; y += 1) {
      const sy = Math.floor((y * cropSide) / scan);
      for (let x = 0; x < scan; x += 1) {
        const sx = Math.floor((x * cropSide) / scan);
        const di = (y * scan + x) * 4;
        const si = (sy * cropSide + sx) * 4;
        scaled[di] = cropped[si]!;
        scaled[di + 1] = cropped[si + 1]!;
        scaled[di + 2] = cropped[si + 2]!;
        scaled[di + 3] = cropped[si + 3]!;
      }
    }
    const intent = upiIntentFromJsQR(decode, scaled, scan, scan);
    if (intent) return intent;
  }
  return null;
}

/**
 * Razorpay’s `image_url` is a branded marketing card (Powered by Razorpay / BHIM
 * chrome). Decode that PNG to recover the native `upi://` intent, then we render
 * a clean square QR for the checkout modal — payload bytes are never rewritten.
 */
export async function decodeUpiIntentFromQrPng(
  pngBytes: Buffer | ArrayBuffer | Uint8Array,
): Promise<string | null> {
  const buf = toNodeBuffer(pngBytes);

  // Razorpay serves PNG; reject non-PNG early so we never mis-decode.
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
    return null;
  }

  const jsQRMod = await import("jsqr");
  const decode = resolveJsQRDecoder(jsQRMod);

  try {
    const sharpHit = await decodeUpiIntentWithSharp(buf, decode);
    if (sharpHit) return sharpHit;
  } catch {
    // Fall through to pngjs when sharp is missing or fails.
  }

  return decodeUpiIntentWithPngjs(buf, decode);
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
 * Live Shirova merchant UPI profile (matches Razorpay `image_content`).
 * Env overrides exist for rotation; defaults keep construct available if
 * `image_content` is momentarily missing.
 */
const DEFAULT_UPI_MERCHANT = {
  /** Live Razorpay VPA from Create QR `image_content` — not a made-up handle. */
  pa: "shirovaaiprivat478370.rzp@rxairtel",
  pn: "Shirova AI",
  tn: "Payment To SHIROVA AI PRIVATE LIMITED",
  mc: "5817",
  mode: "22",
  trSuffix: "qrv2",
} as const;

/**
 * Build the native `upi://` intent for a Razorpay QR Codes API entity.
 *
 * Prefer Razorpay `image_content` when `qr_image_content` is enabled (ticket
 * #19934703). Construct is the no-PNG fallback using:
 *   tr = `${qrId without "qr_"}` + trSuffix   (e.g. qrv2)
 *   am / pa / pn / tn / mc / mode from amount + merchant profile
 */
export function constructRazorpayUpiIntent(input: {
  qrId: string;
  amountPaise: number;
}): string | null {
  if (!/^qr_[A-Za-z0-9]{8,40}$/.test(input.qrId)) return null;
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    return null;
  }

  const pa = env.razorpayUpiPa?.trim() || DEFAULT_UPI_MERCHANT.pa;
  const pn = env.razorpayUpiPn?.trim() || DEFAULT_UPI_MERCHANT.pn;
  const tn = env.razorpayUpiTn?.trim() || DEFAULT_UPI_MERCHANT.tn;
  const mc = env.razorpayUpiMc?.trim() || DEFAULT_UPI_MERCHANT.mc;
  const mode = env.razorpayUpiMode?.trim() || DEFAULT_UPI_MERCHANT.mode;
  const trSuffix =
    env.razorpayUpiTrSuffix?.trim() || DEFAULT_UPI_MERCHANT.trSuffix;

  const am = (input.amountPaise / 100).toFixed(2);
  const tr = `${input.qrId.slice("qr_".length)}${trSuffix}`;
  // Razorpay leaves `@` in `pa` unescaped — do not encodeURIComponent the VPA.
  // Encode `pn` / `tn` (spaces). Param order must match live payloads.
  return (
    `upi://pay?am=${am}&cu=INR&mc=${mc}&mode=${mode}&pa=${pa}` +
    `&pn=${encodeURIComponent(pn)}&tn=${encodeURIComponent(tn)}&tr=${tr}`
  );
}

/** Ensure GPay `am=` matches the charged checkout total. */
export function assertUpiIntentAmount(intent: string, amountPaise: number) {
  const expected = (amountPaise / 100).toFixed(2);
  const match = /(?:^|[?&])am=([0-9]+(?:\.[0-9]+)?)/i.exec(intent);
  if (!match || match[1] !== expected) {
    throw new AppError(
      `UPI amount mismatch (expected ₹${expected}).`,
      502,
      "amount_mismatch",
    );
  }
}

/**
 * Resolve native UPI intent for a Razorpay QR entity.
 * Prefer `image_content` (enabled via qr_image_content), then construct from
 * qr id + amount. Decode branded `image_url` only as last-resort fallback.
 */
export async function resolveUpiQrIntent(
  qr: Pick<
    RazorpayQrCodeEntity,
    "id" | "image_content" | "image_url" | "payment_amount"
  >,
): Promise<string> {
  const direct = qr.image_content?.trim();
  if (direct && /^upi:\/\//i.test(direct)) {
    if (qr.payment_amount > 0) {
      assertUpiIntentAmount(direct, qr.payment_amount);
    }
    return direct;
  }

  const constructed = constructRazorpayUpiIntent({
    qrId: qr.id,
    amountPaise: qr.payment_amount,
  });
  if (constructed) return constructed;

  const imageUrl = qr.image_url?.trim();
  if (!imageUrl) {
    throw new AppError("QR image unavailable.", 502, "razorpay_error");
  }

  // Slow path — only when image_content + construct are unavailable.
  const [{ bytes, contentType }] = await Promise.all([
    fetchRazorpayQrImageBytes(imageUrl),
    import("jsqr"),
    import("qrcode"),
    import("sharp").catch(() => null),
  ]);
  if (!contentType.startsWith("image/")) {
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
