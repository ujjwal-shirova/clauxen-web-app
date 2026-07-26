import { apiFetch, ApiError } from "@/lib/api/client";

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
  fullName?: string;
  countryCode?: string;
  addressLine?: string;
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
  returnPath?: string;
}) {
  assertBillingOrderInput(input);
  return apiFetch<{
    sessionId: string;
    checkoutPath: string;
    returnPath?: string;
    expiresInSeconds: number;
  }>("/api/v1/billing/checkout-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Remint an expired signed checkout session for the same logged-in user. */
export async function refreshCheckoutSession(input: { sessionId: string }) {
  const sessionId = assertNonEmptyString(input.sessionId, "sessionId", 8192);
  return apiFetch<{
    sessionId: string;
    checkoutPath: string;
    returnPath?: string;
    expiresInSeconds: number;
  }>("/api/v1/billing/checkout-sessions/refresh", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
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
  /** Razorpay contact `+91XXXXXXXXXX` — required for payment-link fallback. */
  customerContact?: string;
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
      mode: "qr" | "checkout";
      qrId: string | null;
      imageUrl: string | null;
      imageDataUrl?: string | null;
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
    fulfillment?: {
      status?: string;
      order_id?: string;
      payment_id?: string;
    } | null;
  }>("/api/v1/billing/orders/upi/poll", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyBillingPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  /** First 4 digits only for card-on-file display. Never send full PAN. */
  cardFirst4?: string;
}) {
  assertRazorpayVerifyInput(input);
  const cardFirst4 =
    typeof input.cardFirst4 === "string"
      ? input.cardFirst4.replace(/\D/g, "").slice(0, 4)
      : undefined;
  return apiFetch<{ fulfillment: { status?: string } | null }>(
    "/api/v1/billing/orders/verify",
    {
      method: "POST",
      body: JSON.stringify({
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        ...(cardFirst4 && /^\d{4}$/.test(cardFirst4)
          ? { cardFirst4 }
          : {}),
      }),
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

export async function getBillingInvoice(paymentId: string) {
  return apiFetch<{
    invoice: import("@/components/invoice-view").InvoiceData;
    pdfKey: string | null;
  }>(`/api/v1/billing/invoices/${encodeURIComponent(paymentId)}`);
}

/** Opens the server-generated PDF in a new tab (auth cookies applied). */
export function billingInvoicePdfUrl(paymentId: string) {
  return `/api/v1/billing/invoices/${encodeURIComponent(paymentId)}/pdf`;
}

export type BillingAddressDto = {
  id: string;
  fullName: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
  summary: string;
};

export type PaymentMethodDto = {
  id: string;
  methodType: "card" | "upi";
  network: string;
  brand: string;
  cardFirst4: string | null;
  cardLast4: string | null;
  upiVpa: string | null;
  maskedNumber: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  mandateMaxAmountPaise: number | null;
  createdAt: string;
};

export async function getBillingAddress() {
  return apiFetch<{ address: BillingAddressDto | null }>(
    "/api/v1/billing/address",
  );
}

export async function upsertBillingAddress(input: {
  fullName: string;
  countryCode?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string | null;
  notify?: boolean;
}) {
  return apiFetch<{ address: BillingAddressDto }>("/api/v1/billing/address", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listPaymentMethods() {
  return apiFetch<{ paymentMethods: PaymentMethodDto[] }>(
    "/api/v1/billing/payment-methods",
  );
}

export async function setDefaultPaymentMethod(id: string) {
  return apiFetch<{ paymentMethod: PaymentMethodDto }>(
    `/api/v1/billing/payment-methods/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ action: "set_default" }),
    },
  );
}

export async function deletePaymentMethod(id: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/billing/payment-methods/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function startPaymentMethodSetup(input: {
  method: "card" | "upi";
  contact?: string;
}) {
  return apiFetch<{
    setup: {
      orderId: string;
      amount: number;
      currency: "INR";
      keyId: string;
      customerId: string;
      maxAmountPaise: number;
      method: "card" | "upi";
    };
  }>("/api/v1/billing/payment-methods/setup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyPaymentMethodSetup(input: {
  method: "card" | "upi";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  cardFirst4?: string;
  upiVpa?: string;
  customerId?: string;
}) {
  return apiFetch<{ paymentMethod: PaymentMethodDto }>(
    "/api/v1/billing/payment-methods/setup/verify",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
