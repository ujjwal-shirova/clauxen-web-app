/**
 * clauxen-billing Worker
 *
 * Server-side payment orchestration + invoice PDF (never in the browser).
 *
 * Routes:
 *   GET  /health
 *   POST /v1/razorpay/orders          (internal) create order
 *   POST /v1/razorpay/upi-qr          (internal) create UPI QR
 *   GET  /v1/razorpay/payments/:id    (internal) fetch payment
 *   GET  /v1/razorpay/payments/:id/card (internal) card evidence
 *   POST /v1/razorpay/payments/create (internal) S2S token charge
 *   POST /v1/razorpay/payments/otp/submit|resend (internal) S2S OTP
 *   POST /v1/razorpay/customers      (internal) create/fetch customer
 *   GET  /v1/razorpay/customers/:id  (internal) fetch customer
 *   GET  /v1/razorpay/customers/:id/tokens (internal) saved tokens
 *   DELETE /v1/razorpay/customers/:id/tokens/:token (internal) revoke
 *   GET  /v1/razorpay/orders/:id      (internal) fetch order
 *   GET  /v1/razorpay/qr/:id          (internal) fetch QR
 *   GET  /v1/razorpay/qr/:id/payments (internal) QR payments
 *   POST /v1/razorpay/qr/:id/close    (internal) close QR
 *   POST /v1/razorpay/verify-signature (internal)
 *   POST /v1/invoices/generate        (internal) build PDF → R2 + Razorpay Documents
 *   POST /v1/invoices/fulfill         (internal) PDF → R2 → docs → email w/ PDF
 *   POST /v1/email/send               (internal) invoice / billing notifications
 *   GET  /v1/invoices/:paymentId/pdf  (user JWT or internal)
 *
 * Auth:
 *   Internal: Authorization: Bearer <BILLING_INTERNAL_TOKEN>
 *             or x-clauxen-billing: <BILLING_INTERNAL_TOKEN>
 *   User PDF: Authorization: Bearer <Supabase JWT> (must own payment path)
 */

import { buildInvoicePdf } from "./invoice-pdf";
import { uploadInvoicePdfToRazorpay } from "./razorpay-invoice-upload";
import {
  buildInvoicePaidEmail,
  sendBillingEmail,
  type EmailSendPayload,
} from "./email";
import type {
  InvoiceFulfillRequest,
  InvoiceFulfillResponse,
  InvoiceGenerateRequest,
  InvoiceGenerateResponse,
} from "./types";

export interface Env {
  INVOICES: R2Bucket;
  BILLING_INTERNAL_TOKEN?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  INVOICE_ISSUER_NAME?: string;
  INVOICE_ISSUER_LEGAL?: string;
  INVOICE_ISSUER_ADDRESS?: string;
  INVOICE_GSTIN?: string;
  INVOICE_LUT_NUMBER?: string;
  EMAIL?: {
    send: (msg: {
      to: string | { email: string; name?: string };
      from: string | { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
      attachments?: Array<{
        content: string | ArrayBuffer | ArrayBufferView;
        filename: string;
        type: string;
        disposition: "attachment" | "inline";
      }>;
    }) => Promise<{ messageId?: string }>;
  };
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  APP_ORIGIN?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function isInternal(request: Request, env: Env): boolean {
  const token = env.BILLING_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";
  const header = request.headers.get("x-clauxen-billing") ?? "";
  if (auth.startsWith("Bearer ") && timingSafeEqual(auth.slice(7).trim(), token)) {
    return true;
  }
  return header.length > 0 && timingSafeEqual(header.trim(), token);
}

async function verifyUserJwt(
  request: Request,
  env: Env,
): Promise<{ sub: string } | null> {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ? { sub: user.id } : null;
}

function razorpayAuth(env: Env): string | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
}

async function razorpayApi(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const auth = razorpayAuth(env);
  if (!auth) {
    return json(
      { error: "Razorpay keys are not configured on billing worker." },
      503,
    );
  }
  const res = await fetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type IssuerInfo = {
  name: string;
  brand: string;
  legal: string;
  address: string;
  gstin?: string;
  lutNumber?: string;
};

function issuerFromEnv(env: Env): IssuerInfo {
  return {
    name: env.INVOICE_ISSUER_NAME || "Shirova",
    brand: "Clauxen",
    legal: env.INVOICE_ISSUER_LEGAL || "Shirova",
    address: env.INVOICE_ISSUER_ADDRESS || "India",
    gstin: env.INVOICE_GSTIN?.trim() || undefined,
    lutNumber: env.INVOICE_LUT_NUMBER?.trim() || undefined,
  };
}

async function storeInvoicePdf(
  env: Env,
  payload: InvoiceGenerateRequest,
): Promise<{ pdf: Uint8Array; customerKey: string; salesKey: string }> {
  const pdf = await buildInvoicePdf(payload, issuerFromEnv(env));

  const issued = new Date(payload.issuedAt || Date.now());
  const yyyy = String(issued.getUTCFullYear());
  const mm = String(issued.getUTCMonth() + 1).padStart(2, "0");

  // Customer copy + sales-team archive (same PDF, two keys).
  const customerKey = `invoices/${payload.userId}/${payload.paymentId}.pdf`;
  const salesKey = `invoices/sales/${yyyy}/${mm}/${payload.paymentId}.pdf`;

  const meta = {
    invoiceNumber: payload.invoiceNumber,
    paymentId: payload.paymentId,
    userId: payload.userId,
    orderId: payload.orderId,
    planName: payload.planName,
  };

  await Promise.all([
    env.INVOICES.put(customerKey, pdf, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: meta,
    }),
    env.INVOICES.put(salesKey, pdf, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { ...meta, audience: "sales" },
    }),
  ]);

  return { pdf, customerKey, salesKey };
}

async function attachPdfToRazorpay(
  env: Env,
  payload: InvoiceGenerateRequest,
  pdf: Uint8Array,
): Promise<{ documentId: string; purpose: string } | null> {
  // Best-effort: attach PDF to Razorpay payment (Upload Invoices / Documents).
  const razorpayPaymentId =
    payload.razorpayPaymentId?.trim() || payload.paymentId;
  return uploadInvoicePdfToRazorpay(env, {
    paymentId: razorpayPaymentId,
    pdfBytes: pdf,
    fileName: `${payload.invoiceNumber}.pdf`,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers":
            "authorization,content-type,x-clauxen-billing",
          "access-control-max-age": "86400",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "clauxen-billing",
        razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      });
    }

    // --- Razorpay proxies (internal only) ---
    if (url.pathname.startsWith("/v1/razorpay/")) {
      if (!isInternal(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (request.method === "POST" && url.pathname === "/v1/razorpay/orders") {
        const body = await request.text();
        return razorpayApi(env, "/v1/orders", { method: "POST", body });
      }

      if (request.method === "POST" && url.pathname === "/v1/razorpay/upi-qr") {
        const body = await request.text();
        return razorpayApi(env, "/v1/payments/qr_codes", {
          method: "POST",
          body,
        });
      }

      const payCaptureMatch = url.pathname.match(
        /^\/v1\/razorpay\/payments\/([^/]+)\/capture$/,
      );
      if (request.method === "POST" && payCaptureMatch) {
        const body = await request.text();
        return razorpayApi(env, `/v1/payments/${payCaptureMatch[1]}/capture`, {
          method: "POST",
          body,
        });
      }

      const payMatch = url.pathname.match(/^\/v1\/razorpay\/payments\/([^/]+)$/);
      if (request.method === "GET" && payMatch) {
        // Forward query (e.g. ?expand[]=card) to Razorpay.
        return razorpayApi(env, `/v1/payments/${payMatch[1]}${url.search}`);
      }

      // Card network / issuer / international flag — location evidence.
      const payCardMatch = url.pathname.match(
        /^\/v1\/razorpay\/payments\/([^/]+)\/card$/,
      );
      if (request.method === "GET" && payCardMatch) {
        return razorpayApi(env, `/v1/payments/${payCardMatch[1]}/card`);
      }

      // S2S token charge (Express Pay). Body passed through to Razorpay.
      if (
        request.method === "POST" &&
        url.pathname === "/v1/razorpay/payments/create"
      ) {
        const body = await request.text();
        return razorpayApi(env, "/v1/payments/create", {
          method: "POST",
          body,
        });
      }

      // S2S OTP submit for token-charge next steps.
      if (
        request.method === "POST" &&
        url.pathname === "/v1/razorpay/payments/otp/submit"
      ) {
        const body = await request.text();
        return razorpayApi(env, "/v1/payments/otp/submit", {
          method: "POST",
          body,
        });
      }

      // S2S OTP resend for token-charge next steps.
      if (
        request.method === "POST" &&
        url.pathname === "/v1/razorpay/payments/otp/resend"
      ) {
        const body = await request.text();
        return razorpayApi(env, "/v1/payments/otp/resend", {
          method: "POST",
          body,
        });
      }

      const orderMatch = url.pathname.match(/^\/v1\/razorpay\/orders\/([^/]+)$/);
      if (request.method === "GET" && orderMatch) {
        return razorpayApi(env, `/v1/orders/${orderMatch[1]}`);
      }

      const qrMatch = url.pathname.match(/^\/v1\/razorpay\/qr\/([^/]+)$/);
      if (request.method === "GET" && qrMatch) {
        return razorpayApi(env, `/v1/payments/qr_codes/${qrMatch[1]}`);
      }

      const qrPayMatch = url.pathname.match(
        /^\/v1\/razorpay\/qr\/([^/]+)\/payments$/,
      );
      if (request.method === "GET" && qrPayMatch) {
        return razorpayApi(
          env,
          `/v1/payments/qr_codes/${qrPayMatch[1]}/payments?count=5`,
        );
      }

      const qrCloseMatch = url.pathname.match(
        /^\/v1\/razorpay\/qr\/([^/]+)\/close$/,
      );
      if (request.method === "POST" && qrCloseMatch) {
        return razorpayApi(env, `/v1/payments/qr_codes/${qrCloseMatch[1]}/close`, {
          method: "POST",
          body: "{}",
        });
      }

      // Razorpay customers (token vault owner per Clauxen user).
      if (request.method === "POST" && url.pathname === "/v1/razorpay/customers") {
        const body = await request.text();
        return razorpayApi(env, "/v1/customers", { method: "POST", body });
      }

      const custMatch = url.pathname.match(
        /^\/v1\/razorpay\/customers\/([^/]+)$/,
      );
      if (request.method === "GET" && custMatch) {
        return razorpayApi(env, `/v1/customers/${custMatch[1]}`);
      }

      // Saved tokenized instruments for Express Pay.
      const tokensMatch = url.pathname.match(
        /^\/v1\/razorpay\/customers\/([^/]+)\/tokens$/,
      );
      if (request.method === "GET" && tokensMatch) {
        return razorpayApi(env, `/v1/customers/${tokensMatch[1]}/tokens`);
      }

      const tokenRevokeMatch = url.pathname.match(
        /^\/v1\/razorpay\/customers\/([^/]+)\/tokens\/([^/]+)$/,
      );
      if (request.method === "DELETE" && tokenRevokeMatch) {
        return razorpayApi(
          env,
          `/v1/customers/${tokenRevokeMatch[1]}/tokens/${tokenRevokeMatch[2]}`,
          { method: "DELETE" },
        );
      }

      if (
        request.method === "POST" &&
        url.pathname === "/v1/razorpay/verify-signature"
      ) {
        const body = (await request.json()) as {
          orderId?: string;
          paymentId?: string;
          signature?: string;
        };
        if (!body.orderId || !body.paymentId || !body.signature) {
          return json({ valid: false, error: "missing_fields" }, 400);
        }
        if (!env.RAZORPAY_KEY_SECRET) {
          return json({ valid: false, error: "not_configured" }, 503);
        }
        const expected = await hmacSha256Hex(
          env.RAZORPAY_KEY_SECRET,
          `${body.orderId}|${body.paymentId}`,
        );
        return json({
          valid: timingSafeEqual(expected, body.signature.trim()),
        });
      }

      return json({ error: "Not found" }, 404);
    }

    // --- Invoice generate (internal) ---
    if (request.method === "POST" && url.pathname === "/v1/invoices/generate") {
      if (!isInternal(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const payload = (await request.json()) as InvoiceGenerateRequest;
      if (
        !payload?.invoiceNumber ||
        !payload.paymentId ||
        !payload.userId ||
        !payload.items?.length
      ) {
        return json({ error: "Invalid invoice payload" }, 400);
      }

      const { pdf, customerKey, salesKey } = await storeInvoicePdf(
        env,
        payload,
      );
      const uploaded = await attachPdfToRazorpay(env, payload, pdf);

      const response: InvoiceGenerateResponse = {
        ok: true,
        invoiceNumber: payload.invoiceNumber,
        paymentId: payload.paymentId,
        r2Key: customerKey,
        salesKey,
        contentType: "application/pdf",
        bytes: pdf.byteLength,
        razorpayDocumentId: uploaded?.documentId ?? null,
        razorpayDocumentPurpose: uploaded?.purpose ?? null,
      };
      return json(response);
    }

    // --- Invoice fulfill (internal): PDF → R2 → Razorpay docs → email w/ PDF ---
    if (request.method === "POST" && url.pathname === "/v1/invoices/fulfill") {
      if (!isInternal(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const payload = (await request.json()) as InvoiceFulfillRequest;
      if (
        !payload?.invoiceNumber ||
        !payload.paymentId ||
        !payload.userId ||
        !payload.items?.length ||
        !payload.email?.to
      ) {
        return json({ error: "Invalid invoice fulfill payload" }, 400);
      }

      const { pdf, customerKey, salesKey } = await storeInvoicePdf(
        env,
        payload,
      );
      const uploaded = await attachPdfToRazorpay(env, payload, pdf);

      // Receipt email with the invoice PDF attached + download link.
      const currency = (payload.currency || "INR").toUpperCase();
      const major = (payload.totalPaise / 100).toFixed(2);
      const amountLabel =
        currency === "INR" ? `\u20B9${major}` : `${currency} ${major}`;
      const mail = buildInvoicePaidEmail(
        {
          fromEmail: env.FROM_EMAIL,
          fromName: env.FROM_NAME,
          appOrigin: env.APP_ORIGIN,
        },
        {
          to: payload.email.to,
          invoiceNumber: payload.invoiceNumber,
          planName: payload.planName,
          amountLabel,
          currency,
          paymentId: payload.paymentId,
          billedToName:
            payload.email.billedToName ?? payload.billedTo.name,
          addressSummary:
            payload.email.addressSummary ?? payload.billedTo.address,
          pdfDownloadUrl: payload.email.pdfDownloadUrl,
        },
      );

      let emailed = false;
      let emailError: string | null = null;
      try {
        if (!env.EMAIL?.send) {
          throw new Error("email_binding_missing");
        }
        const pdfCopy = new Uint8Array(pdf.byteLength);
        pdfCopy.set(pdf);
        await env.EMAIL.send({
          to: payload.email.to,
          from: mail.from,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: [
            {
              content: pdfCopy.buffer,
              filename: `clauxen-invoice-${payload.invoiceNumber}.pdf`,
              type: "application/pdf",
              disposition: "attachment",
            },
          ],
        });
        emailed = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : "send_failed";
      }

      const response: InvoiceFulfillResponse = {
        ok: true,
        invoiceNumber: payload.invoiceNumber,
        paymentId: payload.paymentId,
        r2Key: customerKey,
        salesKey,
        contentType: "application/pdf",
        bytes: pdf.byteLength,
        razorpayDocumentId: uploaded?.documentId ?? null,
        razorpayDocumentPurpose: uploaded?.purpose ?? null,
        emailed,
        emailError,
      };
      return json(response);
    }

    // --- Billing notification email (internal) ---
    if (request.method === "POST" && url.pathname === "/v1/email/send") {
      if (!isInternal(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const payload = (await request.json()) as EmailSendPayload;
      if (!payload?.to || !payload.kind) {
        return json({ error: "Invalid email payload" }, 400);
      }
      const result = await sendBillingEmail(env, payload);
      if (!result.ok) {
        return json({ ok: false, error: result.error ?? "send_failed" }, 503);
      }
      return json({ ok: true });
    }

    // --- Invoice PDF download ---
    const pdfMatch = url.pathname.match(/^\/v1\/invoices\/([^/]+)\/pdf$/);
    if (request.method === "GET" && pdfMatch) {
      const paymentId = pdfMatch[1];
      const internal = isInternal(request, env);
      const user = internal ? null : await verifyUserJwt(request, env);
      if (!internal && !user) {
        return json({ error: "Unauthorized" }, 401);
      }

      // User JWT is scoped to their prefix; internal may pass ?userId=
      const userId = user?.sub ?? url.searchParams.get("userId") ?? "";
      if (!userId) {
        return json({ error: "userId required" }, 400);
      }

      const r2Key = `invoices/${userId}/${paymentId}.pdf`;
      const obj = await env.INVOICES.get(r2Key);
      if (!obj) {
        return json({ error: "Invoice not found" }, 404);
      }

      return new Response(obj.body, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="clauxen-invoice-${paymentId}.pdf"`,
          "cache-control": "private, no-store",
        },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
