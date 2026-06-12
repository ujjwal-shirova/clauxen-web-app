import { apiFetch, ApiError } from "@/frontend/lib/api/client";

function assertNonEmptyString(
  value: unknown,
  field: string,
  maxLen = 256,
): string {
  if (typeof value !== "string") {
    throw new ApiError(`Invalid ${field}.`, 400, "invalid_billing_input");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) {
    throw new ApiError(`Invalid ${field}.`, 400, "invalid_billing_input");
  }
  return trimmed;
}

function assertBillingOrderInput(input: {
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  checkoutSessionId?: string;
  maxTier?: string;
}) {
  assertNonEmptyString(input.planId, "planId", 128);
  assertNonEmptyString(input.planName, "planName", 256);
  if (input.billingCycle !== "monthly" && input.billingCycle !== "yearly") {
    throw new ApiError("Invalid billing cycle.", 400, "invalid_billing_input");
  }
  if (input.maxTier !== undefined) {
    assertNonEmptyString(input.maxTier, "maxTier", 64);
  }
}

function assertRazorpayVerifyInput(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  assertNonEmptyString(input.razorpayOrderId, "razorpayOrderId", 128);
  assertNonEmptyString(input.razorpayPaymentId, "razorpayPaymentId", 128);
  assertNonEmptyString(input.razorpaySignature, "razorpaySignature", 256);
}

export type MinimalBillingDetailsInput = {
  purchasingAsBusiness?: boolean;
  gstin?: string;
  billToName?: string;
};

export type BillingPlan = {
  id: string;
  name: string;
  display_name: string;
  price_paise_monthly: number;
  price_paise_yearly: number;
  currency: string;
  token_grant: number;
  features: unknown;
  yearly_supported?: boolean;
  giftable?: boolean;
};

export async function getBillingPlans() {
  return apiFetch<{ plans: BillingPlan[] }>("/api/v1/billing/plans");
}

export async function getBillingSubscription() {
  return apiFetch<{
    subscription: {
      id: string;
      plan_id: string | null;
      status: string;
      billing_cycle: string | null;
      current_period_end: string | null;
      cancel_at_period_end?: boolean;
    } | null;
    balance: {
      tokens_remaining: number;
      tokens_total: number;
      status: string;
    } | null;
    plans: BillingPlan[];
  }>("/api/v1/billing/subscription");
}

export async function createCheckoutSession(input: {
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  currency?: "INR" | "USD";
  maxTier?: string;
  seatBreakdown?: Record<string, number>;
  organizationSeatCount?: number;
}) {
  assertBillingOrderInput(input);
  return apiFetch<{
    sessionId: string;
    checkoutPath: string;
    expiresInSeconds: number;
  }>("/api/v1/billing/checkout-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createBillingOrder(input: {
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  billingDetails: MinimalBillingDetailsInput;
  checkoutSessionId: string;
  currency?: "INR" | "USD";
  maxTier?: string;
  seatBreakdown?: Record<string, number>;
  organizationSeatCount?: number;
}) {
  assertBillingOrderInput(input);
  if (!input.checkoutSessionId) {
    throw new ApiError("checkoutSessionId is required.", 400, "invalid_billing_input");
  }
  return apiFetch<{
    order: { id: string; razorpay_order_id: string };
    razorpay: {
      orderId: string;
      amount: number;
      currency: string;
      keyId?: string;
    };
    pricing: {
      subtotalPaise: number;
      taxPaise: number;
      totalPaise: number;
      taxLabel: string | null;
      gstExempt: boolean;
    };
  }>("/api/v1/billing/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createUpiBillingPayment(input: {
  checkoutSessionId: string;
  billingDetails: MinimalBillingDetailsInput;
  seatBreakdown?: Record<string, number>;
  organizationSeatCount?: number;
}) {
  if (!input.checkoutSessionId) {
    throw new ApiError("checkoutSessionId is required.", 400, "invalid_billing_input");
  }
  return apiFetch<{
    order: { id: string; razorpay_order_id: string };
    razorpay: {
      orderId: string;
      amount: number;
      currency: string;
      keyId?: string;
    };
    upi: {
      qrId: string;
      imageUrl: string;
      closeBy: number | null;
    };
    pricing: {
      subtotalPaise: number;
      taxPaise: number;
      totalPaise: number;
      taxLabel: string | null;
      gstExempt: boolean;
    };
  }>("/api/v1/billing/orders/upi", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function pollUpiBillingPayment(input: {
  qrId: string;
  billingOrderId: string;
}) {
  return apiFetch<{
    status: "pending" | "paid";
    qrStatus?: string;
    fulfillment?: { status?: string } | null;
  }>("/api/v1/billing/orders/upi/poll", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyBillingPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  assertRazorpayVerifyInput(input);
  return apiFetch<{ fulfillment: { status?: string } | null }>(
    "/api/v1/billing/orders/verify",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function cancelBillingSubscription() {
  return apiFetch<{
    subscription: {
      id: string;
      plan_id: string | null;
      status: string;
      cancel_at_period_end: boolean;
      current_period_end: string | null;
    };
  }>("/api/v1/billing/subscription/cancel", { method: "POST" });
}

export async function listInvoices() {
  return apiFetch<{ invoices: unknown[] }>("/api/v1/billing/invoices");
}
