/**
 * Razorpay Custom Checkout — card data stays in the browser and is sent only
 * to Razorpay via razorpay.js createPayment (never to our /api).
 *
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/custom/build-integration/
 */
import { cardNumberDigits } from "@/frontend/lib/card-input-format";

type RazorpayCustomInstance = {
  createPayment: (data: Record<string, unknown>) => void;
  on: (event: string, handler: (response: unknown) => void) => void;
  open?: () => void;
};

type RazorpayCustomConstructor = new (
  options: Record<string, unknown>,
) => RazorpayCustomInstance;

const RAZORPAY_CUSTOM_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/razorpay.js";
const RAZORPAY_KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const RAZORPAY_ORDER_ID_PATTERN = /^order_[A-Za-z0-9]+$/;
const RAZORPAY_PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]+$/;

export type CustomCardDetails = {
  /** Digits only or formatted — we strip non-digits. */
  number: string;
  name: string;
  /** Formatted MM / YY or digits MMYY */
  expiry: string;
  cvc: string;
};

export type RazorpayCustomCardPaymentInput = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  email?: string;
  contact?: string;
  description?: string;
  card: CustomCardDetails;
  onSuccess: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onFailure?: (message: string) => void;
};

function assertCheckoutInput(input: RazorpayCustomCardPaymentInput) {
  if (!RAZORPAY_KEY_ID_PATTERN.test(input.keyId)) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
  if (!RAZORPAY_ORDER_ID_PATTERN.test(input.orderId)) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
}

function assertPaymentResponse(response: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  if (
    !RAZORPAY_ORDER_ID_PATTERN.test(response.razorpay_order_id) ||
    !RAZORPAY_PAYMENT_ID_PATTERN.test(response.razorpay_payment_id) ||
    typeof response.razorpay_signature !== "string" ||
    response.razorpay_signature.length === 0 ||
    response.razorpay_signature.length > 128
  ) {
    throw new Error("Invalid Razorpay payment response.");
  }
}

function parseExpiry(expiry: string): { month: number; year: number } {
  const digits = expiry.replace(/\D/g, "");
  if (digits.length !== 4) {
    throw new Error("Enter a valid expiry date (MM / YY).");
  }
  const month = Number.parseInt(digits.slice(0, 2), 10);
  const year = Number.parseInt(digits.slice(2), 10);
  if (month < 1 || month > 12) {
    throw new Error("Enter a valid expiry month.");
  }
  return { month, year };
}

function getRazorpayCustomCtor(): RazorpayCustomConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { Razorpay?: RazorpayCustomConstructor }).Razorpay ??
    null
  );
}

export function loadRazorpayCustomScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (getRazorpayCustomCtor()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector(
      `script[src="${RAZORPAY_CUSTOM_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () =>
        resolve(Boolean(getRazorpayCustomCtor())),
      );
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CUSTOM_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(getRazorpayCustomCtor()));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Charge a card immediately via Custom Checkout createPayment.
 * Must be called from a user gesture (click).
 */
export async function chargeCardWithRazorpayCustom(
  input: RazorpayCustomCardPaymentInput,
): Promise<void> {
  assertCheckoutInput(input);

  const loaded = await loadRazorpayCustomScript();
  const RazorpayCtor = getRazorpayCustomCtor();
  if (!loaded || !RazorpayCtor) {
    throw new Error("Could not load Razorpay checkout.");
  }

  const number = cardNumberDigits(input.card.number);
  if (number.length < 15 || number.length > 19) {
    throw new Error("Enter a valid card number.");
  }

  const { month, year } = parseExpiry(input.card.expiry);
  const cvv = input.card.cvc.replace(/\D/g, "");
  if (cvv.length < 3 || cvv.length > 4) {
    throw new Error("Enter a valid CVC.");
  }

  const name = input.card.name.trim() || "Customer";
  const email = input.email?.trim();
  if (!email) {
    throw new Error("Email is required to complete card payment.");
  }

  const razorpay = new RazorpayCtor({
    key: input.keyId,
    name: "shirova",
    description: input.description,
  });

  return new Promise<void>((resolve, reject) => {
    razorpay.on("payment.success", async (response: unknown) => {
      try {
        const payload = response as {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        };
        assertPaymentResponse(payload);
        await input.onSuccess(payload);
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    razorpay.on("payment.error", (response: unknown) => {
      const err = response as {
        error?: { description?: string; reason?: string };
      };
      const message =
        err?.error?.description ||
        err?.error?.reason ||
        "Payment was not completed. Please try again.";
      input.onFailure?.(message);
      reject(new Error(message));
    });

    try {
      razorpay.createPayment({
        amount: input.amount,
        currency: input.currency,
        order_id: input.orderId,
        email,
        ...(input.contact ? { contact: input.contact } : {}),
        method: "card",
        card: {
          number,
          name,
          expiry_month: month,
          expiry_year: year,
          cvv,
        },
      });
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new Error("Could not start card payment."),
      );
    }
  });
}
