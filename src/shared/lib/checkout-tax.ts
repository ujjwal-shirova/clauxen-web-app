import { GST_RATE } from "@/lib/plans-catalog";
import { isValidIndianGstin, normalizeGstin } from "@/lib/gstin";

export type CheckoutBillingDetails = {
  fullName: string;
  countryCode: string;
  addressLine: string;
  gstin?: string;
  billToName?: string;
};

export type CheckoutTaxResult = {
  taxInr: number;
  taxPaise: number;
  taxLabel: string | null;
  showTaxRow: boolean;
  isGstExempt: boolean;
  taxNote: string | null;
};

const MIN_ADDRESS_LENGTH = 5;

export function isBillingAddressComplete(addressLine: string): boolean {
  return addressLine.trim().length >= MIN_ADDRESS_LENGTH;
}

export function computeCheckoutTaxInr(
  subtotalInr: number,
  details: CheckoutBillingDetails,
): CheckoutTaxResult {
  const addressComplete = isBillingAddressComplete(details.addressLine);
  const country = details.countryCode.trim().toUpperCase();

  if (country !== "IN") {
    return {
      taxInr: 0,
      taxPaise: 0,
      taxLabel: null,
      showTaxRow: false,
      isGstExempt: false,
      taxNote: null,
    };
  }

  const gstin = details.gstin ? normalizeGstin(details.gstin) : "";
  if (gstin && isValidIndianGstin(gstin)) {
    return {
      taxInr: 0,
      taxPaise: 0,
      taxLabel: "GST",
      showTaxRow: true,
      isGstExempt: true,
      taxNote:
        "Valid GSTIN provided — no GST charged at checkout. Tax invoice will be issued separately.",
    };
  }

  const taxInr = Math.round(subtotalInr * GST_RATE);
  return {
    taxInr,
    taxPaise: taxInr * 100,
    taxLabel: "IGST (18%)",
    showTaxRow: true,
    isGstExempt: false,
    taxNote: null,
  };
}

export function computeCheckoutTaxPaise(
  subtotalPaise: number,
  details: CheckoutBillingDetails,
): CheckoutTaxResult {
  const subtotalInr = Math.round(subtotalPaise / 100);
  const result = computeCheckoutTaxInr(subtotalInr, details);
  return {
    ...result,
    taxPaise: result.taxInr * 100,
  };
}
