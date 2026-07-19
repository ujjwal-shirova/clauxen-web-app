import * as billingRepo from "@/backend/repositories/billing.repository"; // orders, subscriptions, balances, usage
import {
  checkoutSessionPath,
  mintCheckoutSessionToken,
  normalizeCheckoutReturnPath,
  verifyCheckoutSessionToken,
  type CheckoutSessionClaims,
} from "@/backend/billing/checkout-session";
import {
  createRazorpayOrder,
  createRazorpayUpiQr,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  fetchRazorpayQrCode,
  fetchRazorpayQrPayments,
  isRazorpayConfigured,
  newOrderId,
  newReceipt,
  verifyPaymentSignatureSecure,
} from "@/backend/billing/razorpay"; // payment gateway integration
import {
  generateInvoiceOnWorker,
} from "@/backend/billing/billing-worker";
import {
  buildInvoicePayloadFromOrder,
  invoicePayloadToViewData,
} from "@/backend/billing/invoice";
import type { CheckoutBillingDetails } from "@/lib/checkout-tax";
import {
  resolveCheckoutTaxPaise,
  resolveCheckoutTaxPaiseForCurrency,
} from "@/backend/billing/checkout-billing";
import { getServerUsdInrRate } from "@/backend/billing/checkout-currency-server";
import {
  toRazorpayChargeAmount,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import { env } from "@/backend/config/env"; // centralized env — avoid raw process.env in service layer
import { AppError, notFound } from "@/backend/db/errors"; // typed HTTP errors
import { PLAN_TOKEN_GRANTS } from "@/lib/plans-catalog";

const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{8,40}$/;
const RAZORPAY_SIGNATURE_RE = /^[a-f0-9]{64}$/i;
const MAX_CHECKOUT_SUBTOTAL_PAISE = 100_000_000; // ₹1M cap — reject tampered or absurd checkout amounts
const WEBHOOK_CAPTURE_EVENT = "payment.captured";
const CAPTURED_PAYMENT_STATUS = "captured";

function assertPositiveIntegerPaise(value: number, label: string) {
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_CHECKOUT_SUBTOTAL_PAISE
  ) {
    throw new AppError(
      `${label} must be a positive integer.`,
      400,
      "bad_request",
    );
  }
}

function assertRazorpayCheckoutIds(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  if (
    !RAZORPAY_ORDER_ID_RE.test(input.razorpayOrderId) ||
    !RAZORPAY_PAYMENT_ID_RE.test(input.razorpayPaymentId) ||
    !RAZORPAY_SIGNATURE_RE.test(input.razorpaySignature)
  ) {
    throw new AppError(
      "Invalid Razorpay payment identifiers.",
      400,
      "bad_request",
    );
  }
}

function publicRazorpayKeyId(): string {
  const keyId = env.publicRazorpayKeyId || env.razorpayKeyId;
  if (!keyId) {
    throw new AppError(
      "Razorpay public key is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return keyId;
}

// settings/billing UI overview — subscription + balance + catalog plans parallel fetch
export async function getBillingOverview(userId: string) {
  const [subscription, balance, plans] = await Promise.all([
    billingRepo.getUserSubscription(userId),
    billingRepo.getUserBalance(userId),
    billingRepo.listPlans(),
  ]);

  return { subscription, balance, plans };
}

export function createCheckoutSession(input: {
  userId: string;
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  currency?: CheckoutCurrency;
  maxTier?: string | null;
  seatBreakdown?: Record<string, number> | null;
  organizationSeatCount?: number | null;
  returnPath?: string | null;
}) {
  const returnPath = normalizeCheckoutReturnPath(input.returnPath);

  const token = mintCheckoutSessionToken({
    uid: input.userId,
    planId: input.planId.trim(),
    planName: input.planName.trim(),
    billingCycle: input.billingCycle,
    currency: input.currency ?? "INR",
    returnPath,
    ...(input.maxTier ? { maxTier: input.maxTier } : {}),
    ...(input.seatBreakdown ? { seatBreakdown: input.seatBreakdown } : {}),
    ...(input.organizationSeatCount != null
      ? { organizationSeatCount: input.organizationSeatCount }
      : {}),
  });

  return {
    sessionId: token,
    checkoutPath: checkoutSessionPath(token),
    returnPath,
    expiresInSeconds: 30 * 60,
  };
}

export function assertCheckoutSessionForUser(
  sessionId: string,
  userId: string,
): CheckoutSessionClaims {
  const claims = verifyCheckoutSessionToken(sessionId);
  if (claims.uid !== userId) {
    throw new AppError("Checkout session mismatch.", 403, "forbidden");
  }
  return claims;
}

export async function createUpiCheckoutPayment(input: {
  userId: string;
  userEmail: string;
  sessionId: string;
  billingDetails: CheckoutBillingDetails;
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  subtotalPaise: number;
  currency?: CheckoutCurrency;
  maxTier?: string | null;
  seatBreakdown?: Record<string, number> | null;
  organizationSeatCount?: number | null;
}) {
  const claims = assertCheckoutSessionForUser(input.sessionId, input.userId);
  if ((claims.currency ?? "INR") !== "INR") {
    throw new AppError(
      "UPI is only available for INR checkout.",
      400,
      "invalid_currency",
    );
  }

  const checkout = await createCheckoutOrder({
    userId: input.userId,
    userEmail: input.userEmail,
    planId: input.planId,
    planName: input.planName,
    billingCycle: input.billingCycle,
    subtotalPaise: input.subtotalPaise,
    billingDetails: input.billingDetails,
    maxTier: input.maxTier,
    seatBreakdown: input.seatBreakdown,
    organizationSeatCount: input.organizationSeatCount,
  });

  if (!checkout.order) {
    throw new AppError("Could not create billing order.", 500, "billing_error");
  }

  const qr = await createRazorpayUpiQr({
    amountPaise: checkout.razorpay.amount,
    description: input.planName,
    notes: {
      billing_order_id: checkout.order.id,
      user_id: input.userId,
      plan_id: input.planId,
      checkout_session: input.sessionId.slice(0, 120),
    },
  });

  return {
    ...checkout,
    upi: {
      qrId: qr.id,
      imageUrl: qr.image_url,
      closeBy: qr.close_by ?? null,
    },
  };
}

export async function pollUpiQrPayment(input: {
  userId: string;
  qrId: string;
  billingOrderId: string;
}) {
  const order = await billingRepo.getBillingOrderById(input.billingOrderId);
  if (!order || order.user_id !== input.userId) {
    throw new AppError("Order not found.", 404, "not_found");
  }

  const qr = await fetchRazorpayQrCode(input.qrId);
  if (qr.payments_count_received < 1) {
    return { status: "pending" as const, qrStatus: qr.status };
  }

  const payments = await fetchRazorpayQrPayments(input.qrId);
  const captured = payments.items.find((p) => p.status === "captured");
  if (!captured?.order_id) {
    return { status: "pending" as const, qrStatus: qr.status };
  }

  const paymentEntity = await fetchRazorpayPayment(captured.id);
  if (paymentEntity.amount !== order.amount_paise) {
    throw new AppError("Payment amount mismatch.", 400, "amount_mismatch");
  }

  if (captured.order_id !== order.razorpay_order_id) {
    await billingRepo.syncBillingOrderRazorpayId(
      order.id,
      captured.order_id,
    );
  }

  const result = await billingRepo.fulfillPayment({
    orderId: captured.order_id,
    paymentId: captured.id,
    paymentStatus: "captured",
    paymentMethod: paymentEntity.method ?? "upi",
    amountPaise: paymentEntity.amount,
    source: "checkout",
    providerPayload: {
      qrId: input.qrId,
      channel: "upi_qr",
      verifiedAt: new Date().toISOString(),
    },
  });

  void enqueueInvoiceGeneration(captured.order_id, captured.id);

  return { status: "paid" as const, fulfillment: result };
}

export async function createCheckoutOrder(input: {
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  subtotalPaise: number;
  billingDetails: CheckoutBillingDetails;
  currency?: CheckoutCurrency;
  maxTier?: string | null;
  seatBreakdown?: Record<string, number> | null;
  organizationSeatCount?: number | null;
}) {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      503,
      "billing_unavailable",
    );
  }

  const planId = input.planId.trim();
  if (!planId || planId.length > 64) {
    throw new AppError("Invalid planId.", 400, "bad_request");
  }

  assertPositiveIntegerPaise(input.subtotalPaise, "subtotalPaise");

  const tokens = PLAN_TOKEN_GRANTS[planId];
  if (tokens === undefined) {
    throw new AppError("Unknown billing plan.", 400, "invalid_plan");
  }

  const currency: CheckoutCurrency = input.currency ?? "INR";
  const tax = resolveCheckoutTaxPaiseForCurrency(
    input.subtotalPaise,
    input.billingDetails,
    currency,
  );
  const totalInrPaise = input.subtotalPaise + tax.taxPaise;
  assertPositiveIntegerPaise(totalInrPaise, "totalPaise");

  const charge = toRazorpayChargeAmount(
    totalInrPaise,
    currency,
    getServerUsdInrRate(),
  );

  const orderId = newOrderId();
  const receipt = newReceipt();

  const razorpay = await createRazorpayOrder({
    amountMinor: charge.amount,
    currency: charge.currency,
    receipt,
    notes: {
      plan_id: planId,
      user_id: input.userId,
      country: input.billingDetails.countryCode,
      charge_currency: charge.currency,
      inr_total_paise: String(totalInrPaise),
      ...(input.billingDetails.gstin
        ? { gstin: input.billingDetails.gstin }
        : {}),
    },
  });

  const order = await billingRepo.createBillingOrder({
    id: orderId,
    razorpayOrderId: razorpay.id,
    userId: input.userId,
    userEmail: input.userEmail,
    planId,
    planName: input.planName,
    billingCycle: input.billingCycle,
    maxTier: input.maxTier,
    subtotalPaise: input.subtotalPaise,
    taxPaise: tax.taxPaise,
    amountPaise: totalInrPaise,
    tokens,
    receipt,
    metadata: {
      billingDetails: input.billingDetails,
      checkoutCurrency: currency,
      razorpayCharge: charge,
      tax: {
        label: tax.taxLabel,
        paise: tax.taxPaise,
        gstExempt: tax.isGstExempt,
      },
      ...(input.seatBreakdown ? { seatBreakdown: input.seatBreakdown } : {}),
      ...(input.organizationSeatCount != null
        ? { organizationSeatCount: input.organizationSeatCount }
        : {}),
    },
  });

  return {
    order,
    razorpay: {
      orderId: razorpay.id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      keyId: env.publicRazorpayKeyId || env.razorpayKeyId,
    },
  };
}

export async function handleRazorpayWebhook(payload: {
  event: string;
  payload: {
    payment?: {
      entity?: {
        order_id?: string;
        id?: string;
        status?: string;
        amount?: number;
      };
    };
  };
}) {
  if (payload.event !== WEBHOOK_CAPTURE_EVENT) {
    return { status: "ignored", reason: "unsupported_event" };
  }

  const payment = payload.payload.payment?.entity;
  if (!payment?.order_id || !payment.id) return { status: "ignored" }; // incomplete payload — no-op

  if (
    !RAZORPAY_ORDER_ID_RE.test(payment.order_id) ||
    !RAZORPAY_PAYMENT_ID_RE.test(payment.id)
  ) {
    return { status: "ignored", reason: "invalid_payment_ids" };
  }

  const paymentStatus = payment.status ?? CAPTURED_PAYMENT_STATUS;
  if (paymentStatus !== CAPTURED_PAYMENT_STATUS) {
    return { status: "ignored", reason: "non_captured_payment" };
  }

  const amountPaise = payment.amount ?? 0;
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { status: "ignored", reason: "invalid_amount" };
  }

  const result = await billingRepo.fulfillPayment({
    orderId: payment.order_id,
    paymentId: payment.id,
    paymentStatus,
    amountPaise,
    currency: "INR",
    source: "webhook",
    webhookEventName: payload.event,
  });

  void enqueueInvoiceGeneration(payment.order_id, payment.id);

  return result;
}

export async function cancelSubscription(userId: string) {
  const subscription = await billingRepo.cancelActiveSubscription(userId);
  if (!subscription) {
    throw notFound("No active subscription to cancel.");
  }
  return { subscription };
}

/**
 * Server-side verification of Razorpay Standard Checkout success.
 *
 * Per official Razorpay documentation (mandatory step):
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 *   "Always verify the payment signature server-side"
 *   "A failed signature check indicates a potentially fraudulent or tampered payment.
 *    Reject the order entirely — do not fulfil it"
 *
 * We also cross-check:
 *  - Signature using our secret (HMAC order|pay)
 *  - Payment belongs to our order
 *  - Amount + currency match what we created in the Order
 *  - Payment is actually captured
 *
 * Webhook path does similar verification.
 * See also webhook signature verification in razorpay.ts.
 */
export async function verifyCheckoutPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  assertRazorpayCheckoutIds(input);

  if (
    !(await verifyPaymentSignatureSecure({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    }))
  ) {
    throw new AppError("Invalid payment signature.", 400, "invalid_signature");
  }

  const payment = await fetchRazorpayPayment(input.razorpayPaymentId);

  if (payment.order_id !== input.razorpayOrderId) {
    throw new AppError(
      "Payment does not belong to this order.",
      400,
      "payment_order_mismatch",
    );
  }

  const order = await billingRepo.getBillingOrderByRazorpayId(
    input.razorpayOrderId,
  );
  if (!order) {
    throw new AppError("Order not found.", 404, "not_found");
  }

  const razorpayOrder = await fetchRazorpayOrder(input.razorpayOrderId);
  if (payment.amount !== razorpayOrder.amount) {
    throw new AppError("Payment amount mismatch.", 400, "amount_mismatch");
  }

  if (
    payment.currency.toUpperCase() !== razorpayOrder.currency.toUpperCase()
  ) {
    throw new AppError("Payment currency mismatch.", 400, "currency_mismatch");
  }

  const amountPaiseForFulfill =
    payment.currency.toUpperCase() === "INR" ? payment.amount : null;

  if (payment.status !== "captured" && !payment.captured) {
    throw new AppError(
      "Payment is not captured yet.",
      400,
      "payment_not_captured",
    );
  }

  const result = await billingRepo.fulfillPayment({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    paymentStatus: "captured",
    paymentMethod:
      payment.method ??
      (typeof payment.notes === "object" &&
      payment.notes &&
      (payment.notes as Record<string, string>).provider === "apple_pay"
        ? "apple_pay"
        : "card"),
    paymentEmail: payment.email ?? "",
    paymentContact: payment.contact ?? "",
    amountPaise: amountPaiseForFulfill,
    currency: payment.currency,
    source: "checkout",
    providerPayload: {
      currency: payment.currency,
      razorpayAmount: payment.amount,
      inrLedgerPaise: order.amount_paise,
      verifiedAt: new Date().toISOString(),
    },
  });

  void enqueueInvoiceGeneration(input.razorpayOrderId, input.razorpayPaymentId);

  return result;
}

async function enqueueInvoiceGeneration(
  razorpayOrderId: string,
  paymentId: string,
) {
  try {
    const order = await billingRepo.getBillingOrderDetailsByRazorpayId(
      razorpayOrderId,
    );
    if (!order) return;
    const payment = await billingRepo.getBillingPaymentById(paymentId);
    if (!payment) return;

    const payload = buildInvoicePayloadFromOrder({
      order,
      payment,
    });
    const generated = await generateInvoiceOnWorker(payload);
    if (generated?.r2Key) {
      await billingRepo.attachInvoicePdfToPayment(paymentId, {
        r2Key: generated.r2Key,
        invoiceNumber: generated.invoiceNumber,
      });
    }
  } catch (err) {
    console.error("[billing] invoice enqueue failed", err);
  }
}

export async function getInvoiceForUser(input: {
  userId: string;
  paymentId: string;
}) {
  const payment = await billingRepo.getBillingPaymentById(input.paymentId);
  if (!payment || payment.user_id !== input.userId) {
    throw notFound("Invoice not found.");
  }
  const order = await billingRepo.getBillingOrderDetailsByRazorpayId(
    payment.order_id,
  );
  if (!order || order.user_id !== input.userId) {
    throw notFound("Invoice not found.");
  }

  const payload = buildInvoicePayloadFromOrder({ order, payment });
  return {
    invoice: invoicePayloadToViewData(payload),
    pdfKey:
      (payment.provider_payload as { invoicePdfKey?: string } | null)
        ?.invoicePdfKey ?? null,
  };
}

export async function meterChatGeneration(input: {
  userId: string;
  chatId: string;
  messageId: string | null;
  modelId: string;
  outputCharacters: number;
  inputMessageCount: number;
  latencyMs: number;
}) {
  const modelId = input.modelId.trim().slice(0, 128);
  if (!modelId) {
    throw new AppError("modelId is required.", 400, "bad_request");
  }

  const outputCharacters = Math.min(
    Math.max(0, input.outputCharacters),
    1_000_000,
  );
  const inputMessageCount = Math.min(
    Math.max(0, input.inputMessageCount),
    10_000,
  );
  const latencyMs = Math.min(Math.max(0, input.latencyMs), 3_600_000);

  const outputTokens = Math.max(1, Math.ceil(outputCharacters / 4)); // chars → approx tokens
  const inputTokens = Math.max(1, inputMessageCount * 50); // conversation length heuristic

  try {
    await billingRepo.recordModelUsage({
      userId: input.userId,
      workspaceId: null,
      chatId: input.chatId,
      messageId: input.messageId,
      provider: "novita",
      modelId: input.modelId,
      inputTokens,
      outputTokens,
      latencyMs: input.latencyMs,
      metadata: { mode: "chat" },
    });
  } catch {}

  const debitAmount = Math.max(1, outputTokens + Math.ceil(inputTokens / 10)); // billing debit formula
  try {
    await billingRepo.debitUserTokens({
      userId: input.userId,
      amount: debitAmount,
      modelId: input.modelId,
      source: "chat",
      metadata: { chatId: input.chatId, messageId: input.messageId },
    });
  } catch (error) {
    if (error instanceof AppError && error.message.includes("Insufficient")) {
      throw new AppError(
        "Insufficient token balance.",
        402,
        "insufficient_tokens",
      );
    }
    throw error;
  }
}
