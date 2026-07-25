import { AppError, notFound } from "@/server/db/errors";
import { queryOne } from "@/server/db/pool";
import {
  encryptProviderRef,
  fingerprintProviderRef,
  isPaymentMethodEncryptionConfigured,
} from "@/server/billing/payment-method-crypto";
import {
  fetchRazorpayPayment,
  newReceipt,
  verifyPaymentSignatureSecure,
} from "@/server/billing/razorpay";
import {
  createMandateSetupOrder,
  ensureRazorpayCustomer,
  PAYMENT_METHOD_MANDATE_MAX_PAISE,
} from "@/server/billing/razorpay-customers";
import { env } from "@/server/config/env";
import * as profileRepo from "@/server/repositories/billing-profile.repository";
import { sendBillingNotificationEmail } from "@/server/billing/billing-email";

const NAME_RE = /^[\p{L}\p{M}\p{N}\s.',-]{2,120}$/u;
const PIN_RE = /^\d{6}$/;
const UPI_VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export type PublicBillingAddress = {
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

export type PublicPaymentMethod = {
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

function assertAddressInput(input: {
  fullName: string;
  countryCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  if (!NAME_RE.test(input.fullName.trim())) {
    throw new AppError("Enter a valid full name.", 400, "invalid_billing_address");
  }
  if (input.countryCode.trim().toUpperCase() !== "IN") {
    throw new AppError(
      "Only India billing addresses are supported.",
      400,
      "invalid_billing_address",
    );
  }
  if (input.addressLine1.trim().length < 3) {
    throw new AppError("Enter address line 1.", 400, "invalid_billing_address");
  }
  if (input.city.trim().length < 2) {
    throw new AppError("Enter your city.", 400, "invalid_billing_address");
  }
  if (input.state.trim().length < 2) {
    throw new AppError("Select your state.", 400, "invalid_billing_address");
  }
  if (!PIN_RE.test(input.postalCode.trim())) {
    throw new AppError("Enter a valid 6-digit PIN code.", 400, "invalid_billing_address");
  }
}

function toPublicAddress(
  row: NonNullable<
    Awaited<ReturnType<typeof profileRepo.getDefaultBillingAddress>>
  >,
): PublicBillingAddress {
  const summary = [
    row.address_line1,
    row.address_line2,
    row.city,
    row.state,
    row.postal_code,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");

  return {
    id: row.id,
    fullName: row.full_name,
    countryCode: row.country_code,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    phone: row.phone,
    summary,
  };
}

function maskUpiVpa(vpa: string): string {
  const [user, host] = vpa.split("@");
  if (!user || !host) return "UPI";
  if (user.length <= 3) return `${user[0] ?? "*"}••@${host}`;
  return `${user.slice(0, 2)}••${user.slice(-1)}@${host}`;
}

function toPublicPaymentMethod(
  row: profileRepo.PaymentMethodRow,
): PublicPaymentMethod {
  const methodType = row.method_type === "upi" ? "upi" : "card";
  const maskedNumber =
    methodType === "upi"
      ? row.upi_vpa
        ? maskUpiVpa(row.upi_vpa)
        : row.display_label || "UPI"
      : row.card_first4
        ? `${row.card_first4} •••• •••• ••••`
        : row.card_last4
          ? `•••• •••• •••• ${row.card_last4}`
          : "Card on file";

  return {
    id: row.id,
    methodType,
    network: row.network,
    brand: row.brand || (methodType === "upi" ? "UPI" : row.network),
    cardFirst4: row.card_first4,
    cardLast4: row.card_last4,
    upiVpa: row.upi_vpa,
    maskedNumber,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: row.is_default,
    mandateMaxAmountPaise: row.mandate_max_amount_paise,
    createdAt: row.created_at,
  };
}

export async function getBillingAddressForUser(userId: string) {
  const row = await profileRepo.getDefaultBillingAddress(userId);
  return row ? toPublicAddress(row) : null;
}

export async function upsertBillingAddressForUser(
  userId: string,
  input: {
    fullName: string;
    countryCode: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    phone?: string | null;
    notify?: boolean;
  },
) {
  assertAddressInput(input);
  const previous = await profileRepo.getDefaultBillingAddress(userId);
  const row = await profileRepo.upsertBillingAddress({
    userId,
    fullName: input.fullName.trim(),
    countryCode: input.countryCode.trim().toUpperCase(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: (input.addressLine2 ?? "").trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode.trim(),
    phone: input.phone?.trim() || null,
  });
  if (!row) {
    throw new AppError("Could not save billing address.", 500, "save_failed");
  }

  if (input.notify !== false) {
    const profile = await queryOne<{
      email: string | null;
      display_name: string | null;
    }>(`select email, display_name from public.profiles where id = $1 limit 1`, [
      userId,
    ]);
    if (profile?.email) {
      void sendBillingNotificationEmail({
        to: profile.email,
        kind: previous ? "billing_address_updated" : "billing_address_saved",
        fullName: row.full_name,
        summary: toPublicAddress(row).summary,
      }).catch((err) => {
        console.warn("[billing] address email failed", err);
      });
    }
  }

  return toPublicAddress(row);
}

export async function listPaymentMethodsForUser(userId: string) {
  const rows = await profileRepo.listPaymentMethods(userId);
  return rows.map(toPublicPaymentMethod);
}

export async function setDefaultPaymentMethodForUser(userId: string, id: string) {
  const row = await profileRepo.setDefaultPaymentMethod(userId, id);
  if (!row) throw notFound("Payment method not found.");
  return toPublicPaymentMethod(row);
}

export async function deletePaymentMethodForUser(userId: string, id: string) {
  await profileRepo.deletePaymentMethod(userId, id);
  return { ok: true as const };
}

function normalizeNetwork(raw: string | undefined | null): string {
  const n = (raw ?? "").toLowerCase().replace(/\s+/g, "");
  if (n.includes("visa")) return "visa";
  if (n.includes("master")) return "mastercard";
  if (n.includes("amex") || n.includes("american")) return "amex";
  if (n.includes("rupay")) return "rupay";
  if (n.includes("jcb")) return "jcb";
  if (n.includes("discover")) return "discover";
  if (n.includes("upi")) return "upi";
  return "unknown";
}

export async function startPaymentMethodSetup(input: {
  userId: string;
  email: string;
  name?: string | null;
  method: "card" | "upi";
}) {
  if (!isPaymentMethodEncryptionConfigured()) {
    throw new AppError(
      "Payment method encryption is not configured.",
      503,
      "encryption_unavailable",
    );
  }

  const customer = await ensureRazorpayCustomer({
    userId: input.userId,
    email: input.email,
    name: input.name,
  });

  const order = await createMandateSetupOrder({
    customerId: customer.id,
    method: input.method,
    receipt: newReceipt().slice(0, 40),
    userId: input.userId,
  });

  const keyId = env.publicRazorpayKeyId || env.razorpayKeyId;
  if (!keyId) {
    throw new AppError(
      "Razorpay public key is not configured.",
      503,
      "billing_unavailable",
    );
  }

  return {
    orderId: order.id,
    amount: 0,
    currency: "INR" as const,
    keyId,
    customerId: customer.id,
    maxAmountPaise: PAYMENT_METHOD_MANDATE_MAX_PAISE,
    method: input.method,
  };
}

export async function verifyPaymentMethodSetup(input: {
  userId: string;
  method: "card" | "upi";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  cardFirst4?: string | null;
  upiVpa?: string | null;
  customerId?: string | null;
}) {
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

  // Zero-amount mandate / authorized instrument — never require capture for setup.
  if (payment.amount !== 0 && payment.amount !== undefined) {
    // Some banks return a ₹0 auth as status authorized without captured flag.
  }

  if (input.method === "upi") {
    const vpaRaw =
      input.upiVpa?.trim() ||
      (typeof payment.notes === "object" && payment.notes && !Array.isArray(payment.notes)
        ? (payment.notes as Record<string, string>).vpa
        : "") ||
      "";
    const vpa = vpaRaw.toLowerCase();
    if (vpa && !UPI_VPA_RE.test(vpa)) {
      throw new AppError("Enter a valid UPI ID.", 400, "invalid_upi");
    }

    const providerRef =
      payment.token_id ||
      `upi:${payment.id}:${vpa || "mandate"}`;

    const row = await profileRepo.upsertPaymentMethod({
      userId: input.userId,
      providerRefEncrypted: encryptProviderRef(providerRef),
      providerRefFingerprint: fingerprintProviderRef(providerRef),
      methodType: "upi",
      network: "upi",
      brand: "UPI",
      upiVpa: vpa || null,
      displayLabel: vpa ? maskUpiVpa(vpa) : "UPI Autopay",
      razorpayCustomerId: input.customerId ?? null,
      lastPaymentId: payment.id,
      mandateMaxAmountPaise: PAYMENT_METHOD_MANDATE_MAX_PAISE,
      mandateStatus: "active",
      makeDefault: true,
    });
    if (!row) throw new AppError("Could not save UPI method.", 500, "save_failed");
    return toPublicPaymentMethod(row);
  }

  const card = payment.card;
  const last4 = (card?.last4 ?? "").replace(/\D/g, "").slice(-4);
  const first4 = (input.cardFirst4 ?? "").replace(/\D/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(last4)) {
    throw new AppError(
      "Card details were not returned by the payment provider.",
      400,
      "card_details_missing",
    );
  }
  const displayFirst4 = /^\d{4}$/.test(first4) ? first4 : last4;
  const network = normalizeNetwork(card?.network ?? card?.type);
  const providerRef =
    card?.id || payment.token_id || `paycard:${payment.id}:${last4}`;

  const row = await profileRepo.upsertPaymentMethod({
    userId: input.userId,
    providerRefEncrypted: encryptProviderRef(providerRef),
    providerRefFingerprint: fingerprintProviderRef(providerRef),
    methodType: "card",
    network,
    brand: card?.network ?? network,
    cardFirst4: displayFirst4,
    cardLast4: last4,
    expMonth: card?.expiry_month ?? null,
    expYear: card?.expiry_year ?? null,
    razorpayCustomerId: input.customerId ?? null,
    lastPaymentId: payment.id,
    mandateMaxAmountPaise: PAYMENT_METHOD_MANDATE_MAX_PAISE,
    mandateStatus: "active",
    makeDefault: true,
  });
  if (!row) throw new AppError("Could not save card.", 500, "save_failed");
  return toPublicPaymentMethod(row);
}

/**
 * After a successful subscription card payment, persist a PCI-safe card-on-file.
 */
export async function saveCardOnFileFromPayment(input: {
  userId: string;
  razorpayPaymentId: string;
  cardFirst4?: string | null;
}) {
  if (!isPaymentMethodEncryptionConfigured()) {
    console.warn("[billing] encryption unavailable — skipping card-on-file save");
    return null;
  }

  const first4 = (input.cardFirst4 ?? "").replace(/\D/g, "").slice(0, 4);
  if (first4 && !/^\d{4}$/.test(first4)) {
    throw new AppError("Invalid card display digits.", 400, "bad_request");
  }

  const payment = await fetchRazorpayPayment(input.razorpayPaymentId);
  if (payment.method && payment.method !== "card") {
    return null;
  }

  const card = payment.card;
  const last4 = (card?.last4 ?? "").replace(/\D/g, "").slice(-4);
  if (!/^\d{4}$/.test(last4)) {
    return null;
  }

  const providerRef =
    card?.id || payment.token_id || `paycard:${payment.id}:${last4}`;
  const network = normalizeNetwork(card?.network ?? card?.type);
  const displayFirst4 = /^\d{4}$/.test(first4) ? first4 : last4;

  const row = await profileRepo.upsertPaymentMethod({
    userId: input.userId,
    providerRefEncrypted: encryptProviderRef(providerRef),
    providerRefFingerprint: fingerprintProviderRef(providerRef),
    methodType: "card",
    network,
    brand: card?.network ?? network,
    cardFirst4: displayFirst4,
    cardLast4: last4,
    expMonth: card?.expiry_month ?? null,
    expYear: card?.expiry_year ?? null,
    lastPaymentId: payment.id,
    mandateMaxAmountPaise: PAYMENT_METHOD_MANDATE_MAX_PAISE,
    mandateStatus: "active",
    makeDefault: true,
  });

  return row ? toPublicPaymentMethod(row) : null;
}
