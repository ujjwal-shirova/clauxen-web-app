import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";

export type BillingInvoicePayload = {
  invoiceNumber: string;
  paymentId: string;
  orderId: string;
  userId: string;
  issuedAt: string;
  nextBillingAt?: string | null;
  currency: "INR" | "USD";
  status: "paid" | "open" | "draft";
  invoiceKind?: "domestic_gst" | "export_lut" | "exempt_gstin";
  lutNumber?: string | null;
  billedTo: {
    name: string;
    email?: string;
    address?: string;
    gstin?: string;
    phone?: string;
  };
  planName: string;
  billingCycle: string;
  items: Array<{
    label: string;
    sublabel?: string;
    quantity?: string;
    unitAmountPaise: number;
    discountPaise?: number;
    taxPaise?: number;
    amountPaise: number;
  }>;
  seats?: Array<{
    planName: string;
    seats: number;
    unitPaise: number;
    amountPaise: number;
  }>;
  subtotalPaise: number;
  tax?: { label: string; amountPaise: number } | null;
  totalPaise: number;
  amountPaidPaise: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  autoRenew?: boolean;
};

export function isBillingWorkerConfigured(): boolean {
  return Boolean(env.billingWorkerUrl && env.billingInternalToken);
}

async function billingWorkerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!isBillingWorkerConfigured()) {
    throw new AppError(
      "Billing worker is not configured. Set BILLING_WORKER_URL and BILLING_INTERNAL_TOKEN.",
      503,
      "billing_unavailable",
    );
  }

  const url = `${env.billingWorkerUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.billingInternalToken}`,
      "x-clauxen-billing": env.billingInternalToken!,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Prefer Cloudflare billing Worker for Razorpay when configured. */
export async function billingWorkerRazorpay<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await billingWorkerFetch(
    path.startsWith("/v1/") ? path : `/v1/razorpay/${path}`,
    init,
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj = body as {
      error?: { description?: string } | string;
    };
    const message =
      typeof errObj.error === "string"
        ? errObj.error
        : errObj.error?.description ||
          "Billing worker Razorpay request failed.";
    throw new AppError(
      message,
      res.status >= 400 && res.status < 600 ? res.status : 502,
      "razorpay_error",
    );
  }
  return body as T;
}

export async function generateInvoiceOnWorker(
  payload: BillingInvoicePayload,
): Promise<{
  r2Key: string;
  salesKey?: string;
  invoiceNumber: string;
  bytes: number;
  razorpayDocumentId?: string | null;
  razorpayDocumentPurpose?: string | null;
} | null> {
  if (!isBillingWorkerConfigured()) {
    console.warn(
      "[billing] BILLING_WORKER_URL not set — skipping Cloudflare invoice PDF",
    );
    return null;
  }

  try {
    const res = await billingWorkerFetch("/v1/invoices/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      r2Key?: string;
      salesKey?: string;
      invoiceNumber?: string;
      bytes?: number;
      razorpayDocumentId?: string | null;
      razorpayDocumentPurpose?: string | null;
      error?: string;
    };
    if (!res.ok || !body.ok || !body.r2Key) {
      console.error("[billing] invoice generate failed", body);
      return null;
    }
    return {
      r2Key: body.r2Key,
      salesKey: body.salesKey,
      invoiceNumber: body.invoiceNumber ?? payload.invoiceNumber,
      bytes: body.bytes ?? 0,
      razorpayDocumentId: body.razorpayDocumentId ?? null,
      razorpayDocumentPurpose: body.razorpayDocumentPurpose ?? null,
    };
  } catch (err) {
    console.error("[billing] invoice generate error", err);
    return null;
  }
}

export type InvoiceFulfillResult = {
  r2Key: string;
  salesKey?: string;
  invoiceNumber: string;
  bytes: number;
  razorpayDocumentId?: string | null;
  razorpayDocumentPurpose?: string | null;
  emailed: boolean;
  emailError?: string | null;
};

/**
 * Single-call invoice fulfillment on the Cloudflare billing Worker:
 * PDF → R2 (+ sales copy) → Razorpay Documents → receipt email with PDF.
 */
export async function fulfillInvoiceOnWorker(
  payload: BillingInvoicePayload & {
    email: {
      to: string;
      billedToName?: string;
      addressSummary?: string;
      pdfDownloadUrl?: string;
    };
  },
): Promise<InvoiceFulfillResult | null> {
  if (!isBillingWorkerConfigured()) {
    console.warn(
      "[billing] BILLING_WORKER_URL not set — skipping Cloudflare invoice fulfill",
    );
    return null;
  }

  try {
    const res = await billingWorkerFetch("/v1/invoices/fulfill", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      r2Key?: string;
      salesKey?: string;
      invoiceNumber?: string;
      bytes?: number;
      razorpayDocumentId?: string | null;
      razorpayDocumentPurpose?: string | null;
      emailed?: boolean;
      emailError?: string | null;
      error?: string;
    };
    if (!res.ok || !body.ok || !body.r2Key) {
      console.error("[billing] invoice fulfill failed", body);
      return null;
    }
    return {
      r2Key: body.r2Key,
      salesKey: body.salesKey,
      invoiceNumber: body.invoiceNumber ?? payload.invoiceNumber,
      bytes: body.bytes ?? 0,
      razorpayDocumentId: body.razorpayDocumentId ?? null,
      razorpayDocumentPurpose: body.razorpayDocumentPurpose ?? null,
      emailed: body.emailed === true,
      emailError: body.emailError ?? null,
    };
  } catch (err) {
    console.error("[billing] invoice fulfill error", err);
    return null;
  }
}

export async function fetchInvoicePdfFromWorker(input: {
  paymentId: string;
  userId: string;
  userAccessToken?: string;
}): Promise<Response | null> {
  if (!isBillingWorkerConfigured()) return null;

  const path = `/v1/invoices/${encodeURIComponent(input.paymentId)}/pdf?userId=${encodeURIComponent(input.userId)}`;

  if (input.userAccessToken) {
    const url = `${env.billingWorkerUrl}${path}`;
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${input.userAccessToken}`,
      },
    });
  }

  return billingWorkerFetch(path);
}
