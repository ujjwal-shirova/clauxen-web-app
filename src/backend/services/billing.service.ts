import * as billingRepo from "@/backend/repositories/billing.repository"; // orders, subscriptions, balances, usage
import {
  CHECKOUT_SESSION_TTL_SECONDS,
  checkoutSessionPath,
  inspectCheckoutSessionToken,
  mintCheckoutSessionToken,
  normalizeCheckoutReturnPath,
  verifyCheckoutSessionToken,
  type CheckoutSessionClaims,
} from "@/backend/billing/checkout-session";
import {
  createRazorpayOrder,
  createRazorpayUpiPaymentLink,
  createRazorpayUpiQr,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  fetchRazorpayPaymentLink,
  fetchRazorpayQrCode,
  fetchRazorpayQrPayments,
  isRazorpayConfigured,
  newOrderId,
  newReceipt,
  renderCleanUpiQrDataUrl,
  resolveUpiQrIntent,
  verifyPaymentSignatureSecure,
} from "@/backend/billing/razorpay"; // payment gateway integration
import {
  fetchInvoicePdfFromWorker,
  generateInvoiceOnWorker,
} from "@/backend/billing/billing-worker";
import { uploadInvoicePdfToRazorpay } from "@/backend/billing/razorpay-invoice-upload";
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
const WEBHOOK_QR_CREDITED_EVENT = "qr_code.credited";
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
    expiresInSeconds: CHECKOUT_SESSION_TTL_SECONDS,
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

/**
 * Remint a checkout session from an expired (but still signed) token for the
 * same logged-in user — used when a tab is reloaded after the 6h TTL.
 */
export function refreshCheckoutSession(input: {
  userId: string;
  sessionId: string;
}) {
  const inspected = inspectCheckoutSessionToken(input.sessionId);
  if (inspected.status === "invalid") {
    throw new AppError("Invalid checkout session.", 400, "invalid_session");
  }
  if (inspected.claims.uid !== input.userId) {
    throw new AppError("Checkout session mismatch.", 403, "forbidden");
  }

  return createCheckoutSession({
    userId: input.userId,
    planId: inspected.claims.planId,
    planName: inspected.claims.planName,
    billingCycle: inspected.claims.billingCycle,
    currency: inspected.claims.currency ?? "INR",
    maxTier: inspected.claims.maxTier ?? null,
    seatBreakdown: inspected.claims.seatBreakdown ?? null,
    organizationSeatCount: inspected.claims.organizationSeatCount ?? null,
    returnPath: inspected.claims.returnPath ?? null,
  });
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
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Vercel or the billing Worker.",
      503,
      "billing_unavailable",
    );
  }

  const claims = assertCheckoutSessionForUser(input.sessionId, input.userId);
  if ((claims.currency ?? "INR") !== "INR") {
    throw new AppError(
      "UPI is only available for INR checkout.",
      400,
      "invalid_currency",
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

  const tax = resolveCheckoutTaxPaiseForCurrency(
    input.subtotalPaise,
    input.billingDetails,
    "INR",
  );
  const totalInrPaise = input.subtotalPaise + tax.taxPaise;
  assertPositiveIntegerPaise(totalInrPaise, "totalPaise");

  const orderId = newOrderId();
  const receipt = newReceipt();

  // Parallel: Razorpay Order + UPI QR. Prefer Worker when configured so keys
  // can live only on Cloudflare; fall back to direct when Vercel has keys.
  const preferDirect = Boolean(
    env.razorpayKeyId?.trim() && env.razorpayKeySecret?.trim(),
  );

  const orderNotes = {
    plan_id: planId,
    user_id: input.userId,
    billing_order_id: orderId,
    channel: "upi",
    ...(input.billingDetails.gstin
      ? { gstin: input.billingDetails.gstin }
      : {}),
  };

  const qrNotes = {
    billing_order_id: orderId,
    user_id: input.userId,
    plan_id: planId,
    checkout_session: input.sessionId.slice(0, 120),
  };

  const [razorpay, qrSettled] = await Promise.all([
    createRazorpayOrder({
      amountMinor: totalInrPaise,
      currency: "INR",
      receipt,
      preferDirect,
      notes: orderNotes,
    }),
    createRazorpayUpiQr({
      amountPaise: totalInrPaise,
      description: input.planName,
      preferDirect,
      notes: qrNotes,
    }).then(
      (qr) => ({ ok: true as const, qr }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
  ]);

  let qrId: string;
  let closeBy: number | null = null;
  let channel: "upi_qr" | "upi_payment_link" = "upi_qr";
  let imageDataUrl: string | null = null;
  /** Started early so branded-image fetch overlaps the billing_orders insert. */
  let upiIntentPromise: Promise<string> | null = null;

  if (qrSettled.ok) {
    // Live QR Codes — prefer Razorpay `image_content` (qr_image_content enabled).
    // Never show branded image_url; always re-render a clean square from upi://.
    qrId = qrSettled.qr.id;
    closeBy = qrSettled.qr.close_by ?? null;
    upiIntentPromise = resolveUpiQrIntent({
      ...qrSettled.qr,
      payment_amount:
        qrSettled.qr.payment_amount > 0
          ? qrSettled.qr.payment_amount
          : totalInrPaise,
    });
  } else {
    const message =
      qrSettled.err instanceof Error
        ? qrSettled.err.message
        : String(qrSettled.err);
    const unavailable =
      /not found on the server|not enabled|BAD_REQUEST_ERROR/i.test(message);
    if (!unavailable) throw qrSettled.err;

    console.warn(
      "[billing] UPI QR Codes API unavailable — using UPI payment link QR",
      message,
    );

    const expireBySeconds = 20 * 60;
    const link = await createRazorpayUpiPaymentLink({
      amountPaise: totalInrPaise,
      description: input.planName,
      customerName:
        input.billingDetails.fullName || input.billingDetails.billToName,
      customerEmail: input.userEmail,
      expireBySeconds,
      notes: {
        ...qrNotes,
        razorpay_order_id: razorpay.id,
      },
    });
    qrId = link.id;
    channel = "upi_payment_link";
    closeBy = Math.floor(Date.now() / 1000) + expireBySeconds;
    if (link.short_url) {
      upiIntentPromise = Promise.resolve(link.short_url);
    }
  }

  // Overlap UPI intent resolve (usually instant construct) with order insert.
  const orderPromise = billingRepo.createBillingOrder({
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
      checkoutCurrency: "INR",
      channel,
      upiQrId: qrId,
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

  const [order, resolvedIntent] = await Promise.all([
    orderPromise,
    upiIntentPromise ?? Promise.resolve(null),
  ]);

  if (!order) {
    throw new AppError("Could not create billing order.", 500, "billing_error");
  }

  if (resolvedIntent) {
    imageDataUrl = await renderCleanUpiQrDataUrl(resolvedIntent);
    void billingRepo
      .mergeBillingOrderMetadataByUpiQrId(qrId, { upiIntent: resolvedIntent })
      .catch(() => undefined);
  }

  return {
    order,
    razorpay: {
      orderId: razorpay.id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      keyId: env.publicRazorpayKeyId || env.razorpayKeyId,
    },
    upi: {
      mode: "qr" as const,
      qrId,
      /** Clean square PNG data URL — prefer over proxy for instant modal paint. */
      imageDataUrl,
      imageUrl: null as string | null,
      closeBy,
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

  // Payment-link fallback path (when QR Codes API is unavailable).
  if (input.qrId.startsWith("plink_")) {
    const link = await fetchRazorpayPaymentLink(input.qrId);
    if (link.status !== "paid" && (link.amount_paid ?? 0) < order.amount_paise) {
      return { status: "pending" as const, qrStatus: link.status };
    }

    const payments = Array.isArray(link.payments) ? link.payments : [];
    const captured = payments.find(
      (p) =>
        (p.status === "captured" || p.status === "authorized") &&
        Boolean(p.payment_id),
    );
    if (!captured?.payment_id) {
      return { status: "pending" as const, qrStatus: link.status };
    }

    const paymentEntity = await fetchRazorpayPayment(captured.payment_id);
    if (paymentEntity.amount !== order.amount_paise) {
      throw new AppError("Payment amount mismatch.", 400, "amount_mismatch");
    }

    const razorpayOrderId =
      paymentEntity.order_id || captured.order_id || order.razorpay_order_id;
    if (razorpayOrderId !== order.razorpay_order_id) {
      await billingRepo.syncBillingOrderRazorpayId(order.id, razorpayOrderId);
    }

    const result = await billingRepo.fulfillPayment({
      orderId: razorpayOrderId,
      paymentId: captured.payment_id,
      paymentStatus: "captured",
      paymentMethod: paymentEntity.method ?? "upi",
      amountPaise: paymentEntity.amount,
      source: "checkout",
      providerPayload: {
        paymentLinkId: input.qrId,
        channel: "upi_payment_link",
        verifiedAt: new Date().toISOString(),
      },
    });

    await enqueueInvoiceGeneration(razorpayOrderId, captured.payment_id);
    return { status: "paid" as const, fulfillment: result };
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

  await enqueueInvoiceGeneration(captured.order_id, captured.id);

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
      "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Vercel or the billing Worker.",
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
        method?: string;
        notes?: Record<string, string> | string[];
      };
    };
    qr_code?: {
      entity?: {
        id?: string;
        status?: string;
        notes?: Record<string, string> | string[];
      };
    };
  };
}) {
  if (payload.event === WEBHOOK_QR_CREDITED_EVENT) {
    const qrId = payload.payload.qr_code?.entity?.id;
    if (!qrId || !/^qr_[A-Za-z0-9]{8,40}$/.test(qrId)) {
      return { status: "ignored", reason: "invalid_qr_id" };
    }

    const order = await billingRepo.getBillingOrderByUpiQrId(qrId);
    if (!order) {
      return { status: "ignored", reason: "qr_order_not_found" };
    }

    const payments = await fetchRazorpayQrPayments(qrId);
    const captured = payments.items.find((p) => p.status === "captured");
    if (!captured?.id || !captured.order_id) {
      return { status: "ignored", reason: "qr_payment_pending" };
    }

    if (captured.order_id !== order.razorpay_order_id) {
      await billingRepo.syncBillingOrderRazorpayId(order.id, captured.order_id);
    }

    const result = await billingRepo.fulfillPayment({
      orderId: captured.order_id,
      paymentId: captured.id,
      paymentStatus: "captured",
      paymentMethod: captured.method ?? "upi",
      amountPaise: captured.amount,
      currency: "INR",
      source: "webhook",
      webhookEventName: payload.event,
      providerPayload: { qrId, channel: "upi_qr" },
    });

    await enqueueInvoiceGeneration(captured.order_id, captured.id);
    return result;
  }

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

  // UPI QR payments may create a new Razorpay order_id — resolve via notes or metadata.
  let razorpayOrderId = payment.order_id;
  const existing = await billingRepo.getBillingOrderByRazorpayId(razorpayOrderId);
  if (!existing) {
    const notes =
      payment.notes && !Array.isArray(payment.notes) ? payment.notes : null;
    const billingOrderId = notes?.billing_order_id?.trim();
    const upiQrId = notes?.upiQrId?.trim() || notes?.upi_qr_id?.trim();

    if (billingOrderId) {
      const byId = await billingRepo.getBillingOrderById(billingOrderId);
      if (byId) {
        await billingRepo.syncBillingOrderRazorpayId(byId.id, razorpayOrderId);
      }
    } else if (upiQrId) {
      const byQr = await billingRepo.getBillingOrderByUpiQrId(upiQrId);
      if (byQr) {
        await billingRepo.syncBillingOrderRazorpayId(byQr.id, razorpayOrderId);
      }
    }
  }

  const result = await billingRepo.fulfillPayment({
    orderId: razorpayOrderId,
    paymentId: payment.id,
    paymentStatus,
    paymentMethod: payment.method ?? "card",
    amountPaise,
    currency: "INR",
    source: "webhook",
    webhookEventName: payload.event,
  });

  await enqueueInvoiceGeneration(payment.order_id, payment.id);

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

  await enqueueInvoiceGeneration(input.razorpayOrderId, input.razorpayPaymentId);

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
    if (!generated?.r2Key) return;

    let razorpayDocumentId = generated.razorpayDocumentId ?? null;
    let razorpayDocumentPurpose = generated.razorpayDocumentPurpose ?? null;

    // Fallback when Worker stored PDF but could not upload to Razorpay
    // (e.g. keys only on Vercel). Fetch bytes and upload from Next.
    if (!razorpayDocumentId) {
      try {
        const pdfRes = await fetchInvoicePdfFromWorker({
          paymentId: payload.paymentId,
          userId: order.user_id,
        });
        if (pdfRes?.ok) {
          const bytes = new Uint8Array(await pdfRes.arrayBuffer());
          const uploaded = await uploadInvoicePdfToRazorpay({
            paymentId: payload.razorpayPaymentId || paymentId,
            pdfBytes: bytes,
            fileName: `${generated.invoiceNumber}.pdf`,
          });
          razorpayDocumentId = uploaded?.documentId ?? null;
          razorpayDocumentPurpose = uploaded?.purpose ?? null;
        }
      } catch (uploadErr) {
        console.warn("[billing] Razorpay invoice upload fallback failed", uploadErr);
      }
    }

    await billingRepo.attachInvoicePdfToPayment(paymentId, {
      r2Key: generated.r2Key,
      salesKey: generated.salesKey,
      invoiceNumber: generated.invoiceNumber,
      razorpayDocumentId,
      razorpayDocumentPurpose,
    });
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
