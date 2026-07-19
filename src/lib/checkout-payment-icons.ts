/** Payment network / method icons — local SVGs (no third-party logo CDNs at runtime). */

export type CardBrandId =
  | "visa"
  | "mastercard"
  | "amex"
  | "jcb"
  | "discover"
  | "rupay";

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20" role="img">${body}</svg>`,
  )}`;

export const CARD_BRAND_ICONS: Record<
  CardBrandId,
  { label: string; src: string }
> = {
  visa: {
    label: "Visa",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#1A1F71"/><text x="16" y="13.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="700" fill="#fff" letter-spacing="0.5">VISA</text>`,
    ),
  },
  mastercard: {
    label: "Mastercard",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#fff" stroke="#E5E7EB"/><circle cx="12.5" cy="10" r="6" fill="#EB001B"/><circle cx="19.5" cy="10" r="6" fill="#F79E1B"/><path d="M16 5.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6z" fill="#FF5F00"/>`,
    ),
  },
  amex: {
    label: "American Express",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#006FCF"/><text x="16" y="13.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="6.5" font-weight="700" fill="#fff">AMEX</text>`,
    ),
  },
  jcb: {
    label: "JCB",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#0E4C94"/><text x="16" y="13.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="700" fill="#fff">JCB</text>`,
    ),
  },
  discover: {
    label: "Discover",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#FF6000"/><text x="16" y="13.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="5.5" font-weight="800" fill="#fff">DISCOVER</text>`,
    ),
  },
  rupay: {
    label: "RuPay",
    src: svg(
      `<rect width="32" height="20" rx="2.5" fill="#097939"/><text x="16" y="13.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="6.5" font-weight="700" fill="#fff">RuPay</text>`,
    ),
  },
};

/** Inline UPI mark fallback — prefer /checkout/icon-pm-upi.svg in UI. */
export const CHECKOUT_UPI_ICON_URL = "/checkout/icon-pm-upi.svg";

/** Vendored from Stripe fingerprinted assets — served locally (no runtime Stripe CDN). */
export const UPI_APP_ICONS = [
  { alt: "PhonePe", src: "/checkout/upi-apps/phonepe.svg" },
  { alt: "Google Pay", src: "/checkout/upi-apps/gpay.svg" },
  { alt: "Paytm", src: "/checkout/upi-apps/paytm.svg" },
  { alt: "UPI / NPCI", src: "/checkout/upi-apps/npci.svg" },
] as const;

export const DEFAULT_CARD_BRAND_STACK: CardBrandId[] = [
  "visa",
  "mastercard",
  "amex",
  "rupay",
];

export function detectCardBrand(digits: string): CardBrandId | null {
  if (!digits) return null;

  if (/^4/.test(digits)) return "visa";

  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
    return "mastercard";
  }

  if (/^3[47]/.test(digits)) return "amex";

  if (/^35(2[89]|[3-8]\d)/.test(digits)) return "jcb";

  if (/^(508|60[6-8]|6521|6531|81|82)/.test(digits)) return "rupay";

  if (/^(6011|64[4-9]|65)/.test(digits)) return "discover";

  return null;
}

export function getCardBrandStack(detected: CardBrandId | null): CardBrandId[] {
  if (!detected) return DEFAULT_CARD_BRAND_STACK;
  return [detected];
}
