import { AppError, notFound } from "@/server/db/errors";
import { queryOne } from "@/server/db/pool";
import {
  encryptProviderRef,
  fingerprintProviderRef,
  isPaymentMethodEncryptionConfigured,
} from "@/server/billing/payment-method-crypto";
import { fetchRazorpayPayment } from "@/server/billing/razorpay";
import * as profileRepo from "@/server/repositories/billing-profile.repository";
import { sendBillingNotificationEmail } from "@/server/billing/billing-email";

const NAME_RE = /^[\p{L}\p{M}\p{N}\s.',-]{2,120}$/u;
const PIN_RE = /^\d{6}$/;

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
  network: string;
  brand: string;
  cardFirst4: string;
  cardLast4: string;
  maskedNumber: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
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
    throw new AppError("Only India billing addresses are supported.", 400, "invalid_billing_address");
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
  row: NonNullable<Awaited<ReturnType<typeof profileRepo.getDefaultBillingAddress>>>,
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

function toPublicPaymentMethod(row: profileRepo.PaymentMethodRow): PublicPaymentMethod {
  return {
    id: row.id,
    network: row.network,
    brand: row.brand || row.network,
    cardFirst4: row.card_first4,
    cardLast4: row.card_last4,
    // Reveal first four only — rest masked (PCI-safe display).
    maskedNumber: `${row.card_first4} •••• •••• ••••`,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: row.is_default,
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
    const profile = await queryOne<{ email: string | null; display_name: string | null }>(
      `select email, display_name from public.profiles where id = $1 limit 1`,
      [userId],
    );
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
  return "unknown";
}

/**
 * After a successful card payment, persist a PCI-safe card-on-file record.
 * Stores only first4 (client-supplied 4 digits) + last4/network from Razorpay
 * + encrypted Razorpay card_id. Never stores PAN/CVV.
 */
export async function saveCardOnFileFromPayment(input: {
  userId: string;
  razorpayPaymentId: string;
  cardFirst4?: string | null;
}) {
  if (!isPaymentMethodEncryptionConfigured()) {
    console.warn(
      "[billing] PAYMENT_METHOD_ENCRYPTION_KEY unset — skipping card-on-file save",
    );
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
    card?.id ||
    payment.token_id ||
    `paycard:${payment.id}:${last4}`;

  const network = normalizeNetwork(card?.network ?? card?.type);
  const displayFirst4 = /^\d{4}$/.test(first4) ? first4 : last4;

  const row = await profileRepo.upsertPaymentMethod({
    userId: input.userId,
    providerRefEncrypted: encryptProviderRef(providerRef),
    providerRefFingerprint: fingerprintProviderRef(providerRef),
    network,
    brand: card?.network ?? network,
    cardFirst4: displayFirst4,
    cardLast4: last4,
    expMonth: card?.expiry_month ?? null,
    expYear: card?.expiry_year ?? null,
    lastPaymentId: payment.id,
    makeDefault: true,
  });

  return row ? toPublicPaymentMethod(row) : null;
}
