import {
  type CheckoutCurrency,
  defaultCurrencyForCountry,
  isCheckoutCurrency,
} from "@/lib/checkout-currency";

const STORAGE_KEY = "clauxen_checkout_currency";

const INDIA_TIMEZONES = new Set([
  "Asia/Kolkata",
  "Asia/Calcutta",
  "Asia/Colombo",
]);

function browserCountryGuess(): string {
  if (typeof window === "undefined") return "IN";

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && INDIA_TIMEZONES.has(tz)) return "IN";
  } catch {
    // ignore
  }

  const languages = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const lang of languages) {
    const normalized = lang.toUpperCase();
    if (
      normalized.endsWith("-IN") ||
      normalized === "HI" ||
      normalized === "BN" ||
      normalized === "TA"
    ) {
      return "IN";
    }
  }

  return "US";
}

export function readStoredCheckoutCurrency(): CheckoutCurrency | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isCheckoutCurrency(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeCheckoutCurrency(currency: CheckoutCurrency) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // ignore quota / private mode
  }
}

export function detectBrowserCheckoutCurrency(): CheckoutCurrency {
  return defaultCurrencyForCountry(browserCountryGuess());
}

export async function resolveInitialCheckoutCurrency(): Promise<CheckoutCurrency> {
  const stored = readStoredCheckoutCurrency();
  if (stored) return stored;

  const browserGuess = detectBrowserCheckoutCurrency();

  try {
    const response = await fetch("/api/v1/geo/checkout-default", {
      credentials: "same-origin",
    });
    if (response.ok) {
      const json = (await response.json()) as {
        data?: { currency?: string };
      };
      const currency = json.data?.currency;
      if (isCheckoutCurrency(currency)) {
        // Prefer local India signals over edge geo that often resolves to USD.
        if (browserGuess === "INR" && currency === "USD") {
          return "INR";
        }
        return currency;
      }
    }
  } catch {
    // fall through to browser heuristics
  }

  return browserGuess;
}

export function getPublicUsdInrRate(): number {
  const raw = process.env.NEXT_PUBLIC_CHECKOUT_USD_INR_RATE;
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 95.58;
}
