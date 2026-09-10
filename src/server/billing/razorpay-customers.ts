import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import {
  billingWorkerRazorpay,
  isBillingWorkerConfigured,
} from "@/server/billing/billing-worker";
import { isRazorpayConfigured } from "@/server/billing/razorpay";

/** ₹25,000 mandate ceiling — authorization only, ₹0 charged at setup. */
export const PAYMENT_METHOD_MANDATE_MAX_PAISE = 2_500_000;

function authHeader(): string {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`;
}

async function razorpayDirect<T>(path: string, init?: RequestInit): Promise<T> {
  // Prefer the Cloudflare billing Worker so Razorpay secrets can live
  // only on Cloudflare; fall back to direct keys on Vercel when set.
  if (isBillingWorkerConfigured()) {
    const method = (init?.method ?? "GET").toUpperCase();
    let workerPath: string | null = null;
    if (path === "/v1/customers" && method === "POST") {
      workerPath = "/v1/razorpay/customers";
    } else if (path === "/v1/orders" && method === "POST") {
      workerPath = "/v1/razorpay/orders";
    } else {
      const cust = path.match(/^\/v1\/customers\/([^/?]+)$/);
      if (cust && method === "GET") {
        workerPath = `/v1/razorpay/customers/${cust[1]}`;
      }
    }
    if (workerPath) {
      try {
        return await billingWorkerRazorpay<T>(workerPath, init);
      } catch (err) {
        if (env.billingRequireWorker) throw err;
        if (!env.razorpayKeyId || !env.razorpayKeySecret) throw err;
      }
    }
  }
  const res = await fetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { description?: string };
  };
  if (!res.ok) {
    throw new AppError(
      body.error?.description || "Razorpay API request failed.",
      502,
      "razorpay_error",
    );
  }
  return body as T;
}

export type RazorpayCustomer = {
  id: string;
  email?: string;
  name?: string;
  contact?: string;
};

export async function fetchRazorpayCustomer(
  customerId: string,
): Promise<RazorpayCustomer> {
  return razorpayDirect<RazorpayCustomer>(
    `/v1/customers/${encodeURIComponent(customerId)}`,
  );
}

/** Create or reuse a Razorpay customer for the authenticated user. */
export async function ensureRazorpayCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
  contact?: string | null;
}): Promise<RazorpayCustomer> {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }

  return razorpayDirect<RazorpayCustomer>("/v1/customers", {
    method: "POST",
    body: JSON.stringify({
      name: (input.name || input.email.split("@")[0] || "Customer").slice(0, 120),
      email: input.email.slice(0, 320),
      contact: input.contact || undefined,
      fail_existing: "0",
      notes: { clauxen_user_id: input.userId },
    }),
  });
}

/**
 * Create a ₹0 authorization order with a ₹25,000 mandate ceiling.
 * No money is captured — Razorpay registers the payment instrument only.
 */
export async function createMandateSetupOrder(input: {
  customerId: string;
  method: "card" | "upi";
  receipt: string;
  userId: string;
}) {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay is not configured.",
      503,
      "billing_unavailable",
    );
  }

  const expireAt = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60;
  const body: Record<string, unknown> = {
    amount: 0,
    currency: "INR",
    customer_id: input.customerId,
    receipt: input.receipt.slice(0, 40),
    payment_capture: true,
    notes: {
      purpose: "payment_method_setup",
      clauxen_user_id: input.userId,
      method: input.method,
      mandate_max_paise: String(PAYMENT_METHOD_MANDATE_MAX_PAISE),
    },
    token: {
      max_amount: PAYMENT_METHOD_MANDATE_MAX_PAISE,
      expire_at: expireAt,
      frequency: "as_presented",
    },
  };

  if (input.method === "upi") {
    body.method = "upi";
  }

  return razorpayDirect<{
    id: string;
    amount: number;
    currency: string;
    customer_id?: string;
  }>("/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
