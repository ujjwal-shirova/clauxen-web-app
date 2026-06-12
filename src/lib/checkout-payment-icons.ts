/** Payment network / method icon URLs used in checkout UI. */

export const CHECKOUT_UPI_ICON_URL =
  "https://js.stripe.com/v3/fingerprinted/img/payment-methods/icon-pm-upi-9107c036320866a1dae0be4b59015a31.svg";

const LOGO_CTX =
  "https://logos.context.dev/?publicClientId=brandLL_2e85d343a7c6c164be5d27c628bd8ef70b7cb7f3f3b28d28";

export type CardBrandId =
  | "visa"
  | "mastercard"
  | "amex"
  | "jcb"
  | "discover"
  | "rupay";

export const CARD_BRAND_ICONS: Record<CardBrandId, { label: string; src: string }> =
  {
    visa: {
      label: "Visa",
      src: "https://i.pinimg.com/736x/3b/38/ef/3b38ef8f2bf7505815dbbe732d838ddc.jpg",
    },
    mastercard: {
      label: "Mastercard",
      src: `${LOGO_CTX}&domain=www.mastercard.com`,
    },
    amex: {
      label: "American Express",
      src: `${LOGO_CTX}&domain=americanexpress.com`,
    },
    jcb: {
      label: "JCB",
      src: `${LOGO_CTX}&domain=www.global.jcb`,
    },
    discover: {
      label: "Discover",
      src: `${LOGO_CTX}&domain=www.discover.com`,
    },
    rupay: {
      label: "RuPay",
      src: `${LOGO_CTX}&domain=www.rupay.co.in`,
    },
  };

export const DEFAULT_CARD_BRAND_STACK: CardBrandId[] = [
  "visa",
  "mastercard",
  "amex",
  "discover",
];

export function detectCardBrand(digits: string): CardBrandId | null {
  if (!digits) return null;

  if (/^4/.test(digits)) return "visa";

  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
    return "mastercard";
  }

  if (/^3[47]/.test(digits)) return "amex";

  if (/^35(2[89]|[3-8]\d)/.test(digits)) return "jcb";

  if (/^(508|606|607|608|6521)/.test(digits)) return "rupay";

  if (/^(6011|64[4-9]|65)/.test(digits)) return "discover";

  return null;
}

/** Four icons for the card field — detected brand animates to the front. */
export function getCardBrandStack(detected: CardBrandId | null): CardBrandId[] {
  const pool: CardBrandId[] = [
    "visa",
    "mastercard",
    "amex",
    "discover",
    "jcb",
    "rupay",
  ];

  if (!detected) {
    return DEFAULT_CARD_BRAND_STACK;
  }

  const rest = pool.filter((id) => id !== detected);
  return [...rest.slice(0, 3), detected];
}
