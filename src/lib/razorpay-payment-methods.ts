/**
 * Razorpay Standard Checkout payment method presets.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/
 */

export type CheckoutPaymentMethodId =
  | "card"
  | "google_pay"
  | "phonepe"
  | "paytm"
  | "upi";

export type CheckoutPaymentMethodOption = {
  id: CheckoutPaymentMethodId;
  label: string;
  shortLabel: string;
  /** Razorpay display block accent (brand hint for UI only) */
  accent: string;
  indiaOnly: boolean;
};

export const CHECKOUT_PAYMENT_METHODS: CheckoutPaymentMethodOption[] = [
  {
    id: "card",
    label: "Credit / Debit card",
    shortLabel: "Card",
    accent: "#1a1f36",
    indiaOnly: false,
  },
  {
    id: "google_pay",
    label: "Google Pay",
    shortLabel: "GPay",
    accent: "#4285F4",
    indiaOnly: true,
  },
  {
    id: "phonepe",
    label: "PhonePe",
    shortLabel: "PhonePe",
    accent: "#5F259F",
    indiaOnly: true,
  },
  {
    id: "paytm",
    label: "Paytm",
    shortLabel: "Paytm",
    accent: "#00BAF2",
    indiaOnly: true,
  },
  {
    id: "upi",
    label: "Other UPI",
    shortLabel: "UPI",
    accent: "#097939",
    indiaOnly: true,
  },
];

type RazorpayDisplayInstrument = Record<string, unknown>;

function upiInstrument(apps: string[]): RazorpayDisplayInstrument {
  return {
    method: "upi",
    flows: ["intent", "qr", "collect"],
    apps,
  };
}

function buildBlock(
  code: string,
  instruments: RazorpayDisplayInstrument[],
): Record<string, unknown> {
  return {
    display: {
      blocks: {
        [code]: {
          name: "Payment",
          instruments,
        },
      },
      sequence: [`block.${code}`],
      preferences: {
        show_default_blocks: false,
      },
    },
  };
}

/**
 * Express checkout (Apple Pay) — Razorpay injects Apple Pay when eligible.
 * Do not set show_default_blocks: false here or Apple Pay will be hidden.
 * @see https://razorpay.com/docs/payments/payment-methods/apple-pay/
 */
export function buildRazorpayConfigForExpressCheckout(): Record<string, unknown> {
  return {
    display: {
      blocks: {
        express: {
          name: "Pay",
          instruments: [
            {
              method: "card",
              networks: ["Visa", "MasterCard", "RuPay", "American Express"],
            },
          ],
        },
      },
      sequence: ["block.express"],
      preferences: {
        show_default_blocks: true,
      },
    },
  };
}

/** Runtime Razorpay `config` for the selected payment method. */
export function buildRazorpayConfigForMethod(
  methodId: CheckoutPaymentMethodId,
): Record<string, unknown> {
  switch (methodId) {
    case "card":
      return buildBlock("card", [
        {
          method: "card",
          networks: ["Visa", "MasterCard", "RuPay", "American Express"],
        },
      ]);
    case "google_pay":
      return buildBlock("google_pay", [upiInstrument(["google_pay"])]);
    case "phonepe":
      return buildBlock("phonepe", [upiInstrument(["phonepe"])]);
    case "paytm":
      return buildBlock("paytm", [
        upiInstrument(["paytm"]),
        {
          method: "wallet",
          wallets: ["paytm"],
        },
      ]);
    case "upi":
      return buildBlock("upi", [
        upiInstrument(["google_pay", "phonepe", "paytm", "bhim"]),
      ]);
    default:
      return buildBlock("card", [{ method: "card" }]);
  }
}

/**
 * Broad checkout supporting all standard methods (Cards, UPI, Netbanking, Wallets).
 * Explicitly no EMI or Pay Later instruments.
 */
export function buildRazorpayConfigForAllStandardMethods(): Record<string, unknown> {
  return {
    display: {
      blocks: {
        card: {
          name: "Card",
          instruments: [
            {
              method: "card",
              networks: ["Visa", "MasterCard", "RuPay", "American Express"],
            },
          ],
        },
        upi: {
          name: "UPI",
          instruments: [
            upiInstrument(["google_pay", "phonepe", "paytm", "bhim"]),
          ],
        },
        netbanking: {
          name: "Netbanking",
          instruments: [{ method: "netbanking" }],
        },
        wallets: {
          name: "Wallets",
          instruments: [
            {
              method: "wallet",
              wallets: ["paytm", "phonepe", "amazonpay", "mobikwik", "freecharge"],
            },
          ],
        },
      },
      sequence: ["block.card", "block.upi", "block.netbanking", "block.wallets"],
      preferences: {
        show_default_blocks: false,
      },
    },
  };
}

export function getAvailablePaymentMethods(countryCode: string) {
  const isIndia = countryCode.trim().toUpperCase() === "IN";
  return CHECKOUT_PAYMENT_METHODS.filter(
    (method) => !method.indiaOnly || isIndia,
  );
}

export function requiresIndianPhone(methodId: CheckoutPaymentMethodId): boolean {
  return methodId !== "card";
}
