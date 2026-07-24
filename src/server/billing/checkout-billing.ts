import { AppError } from "@/server/db/errors";
import type { CheckoutCurrency } from "@/lib/checkout-currency";
import {
  type CheckoutBillingDetails,
  computeCheckoutTaxPaise,
  isBillingAddressComplete,
} from "@/lib/checkout-tax";
import { isKnownCountryCode } from "@/lib/countries";
import { isValidIndianGstin, normalizeGstin } from "@/lib/gstin";

const ISO_COUNTRY_RE = /^[A-Z]{2}$/;
const MAX_NAME_LEN = 120;
const MAX_ADDRESS_LEN = 300;
const MAX_GSTIN_LEN = 15;

function sanitizeText(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") {
    throw new AppError(`Invalid ${field}.`, 400, "invalid_billing_details");
  }
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (!trimmed || trimmed.length > maxLen) {
    throw new AppError(`Invalid ${field}.`, 400, "invalid_billing_details");
  }
  return trimmed;
}

export type MinimalCheckoutBillingInput = {
  purchasingAsBusiness?: boolean;
  gstin?: string;
  billToName?: string;
  fullName?: string;
  countryCode?: string;
  addressLine?: string;
};

export function parseMinimalCheckoutBillingInput(
  raw: unknown,
): MinimalCheckoutBillingInput {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const purchasingAsBusiness = record.purchasingAsBusiness === true;

  let gstin: string | undefined;
  if (
    purchasingAsBusiness &&
    record.gstin !== undefined &&
    record.gstin !== null &&
    record.gstin !== ""
  ) {
    const rawGstin = sanitizeText(record.gstin, "gstin", MAX_GSTIN_LEN);
    const normalized = normalizeGstin(rawGstin);
    if (!isValidIndianGstin(normalized)) {
      throw new AppError("Invalid Indian GSTIN.", 400, "invalid_gstin");
    }
    gstin = normalized;
  }

  let billToName: string | undefined;
  if (
    purchasingAsBusiness &&
    record.billToName !== undefined &&
    record.billToName !== null &&
    record.billToName !== ""
  ) {
    billToName = sanitizeText(record.billToName, "billToName", MAX_NAME_LEN);
  }

  let fullName: string | undefined;
  if (
    record.fullName !== undefined &&
    record.fullName !== null &&
    record.fullName !== ""
  ) {
    fullName = sanitizeText(record.fullName, "fullName", MAX_NAME_LEN);
  }

  let countryCode: string | undefined;
  if (
    record.countryCode !== undefined &&
    record.countryCode !== null &&
    record.countryCode !== ""
  ) {
    const code = sanitizeText(record.countryCode, "countryCode", 2).toUpperCase();
    if (!ISO_COUNTRY_RE.test(code) || !isKnownCountryCode(code)) {
      throw new AppError("Invalid country.", 400, "invalid_billing_details");
    }
    countryCode = code;
  }

  let addressLine: string | undefined;
  if (
    record.addressLine !== undefined &&
    record.addressLine !== null &&
    record.addressLine !== ""
  ) {
    addressLine = sanitizeText(
      record.addressLine,
      "addressLine",
      MAX_ADDRESS_LEN,
    );
  }

  return {
    purchasingAsBusiness,
    gstin,
    billToName,
    fullName,
    countryCode,
    addressLine,
  };
}

/** Merge client billing address with authenticated user identity defaults. */
export function buildCheckoutBillingDetailsForUser(
  user: { displayName?: string | null; email?: string | null },
  minimal: MinimalCheckoutBillingInput,
): CheckoutBillingDetails {
  const fullName = (
    minimal.fullName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Customer"
  ).slice(0, MAX_NAME_LEN);

  const countryCode = minimal.countryCode?.trim().toUpperCase() || "IN";
  const addressLine = (
    minimal.addressLine?.trim() || "India"
  ).slice(0, MAX_ADDRESS_LEN);

  if (minimal.addressLine && !isBillingAddressComplete(addressLine)) {
    throw new AppError(
      "A complete billing address is required.",
      400,
      "invalid_billing_details",
    );
  }

  return {
    fullName,
    countryCode,
    addressLine,
    gstin: minimal.gstin,
    billToName: minimal.billToName,
  };
}

/** Legacy full billing payload — still accepted for backwards compatibility. */
export function parseCheckoutBillingDetails(
  raw: unknown,
): CheckoutBillingDetails {
  if (!raw || typeof raw !== "object") {
    throw new AppError(
      "billingDetails is required.",
      400,
      "invalid_billing_details",
    );
  }

  const record = raw as Record<string, unknown>;

  if (
    record.purchasingAsBusiness !== undefined &&
    record.fullName === undefined &&
    record.addressLine === undefined
  ) {
    throw new AppError(
      "Authenticated user context is required for checkout billing.",
      400,
      "invalid_billing_details",
    );
  }

  const fullName = sanitizeText(record.fullName, "fullName", MAX_NAME_LEN);
  const countryCode = sanitizeText(
    record.countryCode,
    "countryCode",
    2,
  ).toUpperCase();

  if (!ISO_COUNTRY_RE.test(countryCode) || !isKnownCountryCode(countryCode)) {
    throw new AppError("Invalid country.", 400, "invalid_billing_details");
  }

  const addressLine = sanitizeText(
    record.addressLine,
    "addressLine",
    MAX_ADDRESS_LEN,
  );

  if (!isBillingAddressComplete(addressLine)) {
    throw new AppError(
      "A complete billing address is required.",
      400,
      "invalid_billing_details",
    );
  }

  let gstin: string | undefined;
  if (record.gstin !== undefined && record.gstin !== null && record.gstin !== "") {
    const rawGstin = sanitizeText(record.gstin, "gstin", MAX_GSTIN_LEN);
    const normalized = normalizeGstin(rawGstin);
    if (countryCode === "IN" && !isValidIndianGstin(normalized)) {
      throw new AppError("Invalid Indian GSTIN.", 400, "invalid_gstin");
    }
    gstin = normalized;
  }

  let billToName: string | undefined;
  if (
    record.billToName !== undefined &&
    record.billToName !== null &&
    record.billToName !== ""
  ) {
    billToName = sanitizeText(record.billToName, "billToName", MAX_NAME_LEN);
  }

  return {
    fullName,
    countryCode,
    addressLine,
    gstin,
    billToName,
  };
}

export function resolveCheckoutTaxPaise(
  subtotalPaise: number,
  billingDetails: CheckoutBillingDetails,
) {
  return computeCheckoutTaxPaise(subtotalPaise, billingDetails);
}

export function resolveCheckoutTaxPaiseForCurrency(
  subtotalPaise: number,
  billingDetails: CheckoutBillingDetails,
  currency: CheckoutCurrency,
) {
  if (currency === "USD") {
    return {
      taxInr: 0,
      taxPaise: 0,
      taxLabel: null,
      showTaxRow: false,
      isGstExempt: false,
      taxNote: null,
    };
  }
  return resolveCheckoutTaxPaise(subtotalPaise, billingDetails);
}
