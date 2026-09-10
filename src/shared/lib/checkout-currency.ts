/** Checkout display + charge currencies (Razorpay). INR is the internal catalog base. */

export type CheckoutCurrency = "INR" | "USD";

export const CHECKOUT_CURRENCIES: CheckoutCurrency[] = ["INR", "USD"];

export const CHECKOUT_CURRENCY_LABELS: Record<
  CheckoutCurrency,
  { code: CheckoutCurrency; label: string; flag: string }
> = {
  INR: { code: "INR", label: "INR", flag: "🇮🇳" },
  USD: { code: "USD", label: "USD", flag: "🇺🇸" },
};

/** Fallback when env is unset — override via CHECKOUT_USD_INR_RATE. */
export const DEFAULT_USD_INR_RATE = 95.58;

export function isCheckoutCurrency(value: unknown): value is CheckoutCurrency {
  return value === "INR" || value === "USD";
}

export function parseUsdInrRate(raw: string | undefined | null): number {
  if (!raw?.trim()) return DEFAULT_USD_INR_RATE;
  const parsed = Number.parseFloat(raw.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_USD_INR_RATE;
  return parsed;
}

export function defaultCurrencyForCountry(countryCode: string): CheckoutCurrency {
  return countryCode.trim().toUpperCase() === "IN" ? "INR" : "USD";
}

/**
 * Conservative checkout country: any India signal (declared or IP) → IN.
 * Unknown IP also defaults to IN so GST cannot be skipped before geo loads.
 */
export function effectiveCountryForCheckout(
  declaredCountry: string,
  ipCountry: string,
): string {
  const declared = declaredCountry.trim().toUpperCase();
  const ip = ipCountry.trim().toUpperCase();
  if (declared === "IN" || ip === "IN" || !ip) return "IN";
  if (/^[A-Z]{2}$/.test(declared)) return declared;
  if (/^[A-Z]{2}$/.test(ip)) return ip;
  return "IN";
}

/** INR rupees (whole or fractional) → formatted checkout string. */
export function formatCheckoutAmountInr(
  amountInr: number,
  currency: CheckoutCurrency,
  usdInrRate: number,
): string {
  if (currency === "INR") {
    const hasFraction = Math.abs(amountInr % 1) > 0.001;
    return `₹${amountInr.toLocaleString("en-IN", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })}`;
  }

  const usd = amountInr / usdInrRate;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCheckoutAmountFromPaise(
  amountPaise: number,
  currency: CheckoutCurrency,
  usdInrRate: number,
): string {
  return formatCheckoutAmountInr(amountPaise / 100, currency, usdInrRate);
}

/**
 * Convert internal INR paise to Razorpay charge minor units.
 * Razorpay live FX may differ; this uses the configured reference rate until FX API is wired.
 */
export function toRazorpayChargeAmount(
  inrPaise: number,
  currency: CheckoutCurrency,
  usdInrRate: number,
): { amount: number; currency: CheckoutCurrency } {
  if (!Number.isInteger(inrPaise) || inrPaise <= 0) {
    throw new Error("Invalid INR paise amount.");
  }

  if (currency === "INR") {
    return { amount: inrPaise, currency: "INR" };
  }

  const inrRupees = inrPaise / 100;
  const usdDollars = inrRupees / usdInrRate;
  const usdCents = Math.max(1, Math.round(usdDollars * 100));
  return { amount: usdCents, currency: "USD" };
}
