import {
  buildRazorpayConfigForExpressCheckout,
  buildRazorpayConfigForMethod,
  type CheckoutPaymentMethodId,
} from "@/lib/razorpay-payment-methods";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

const RAZORPAY_CHECKOUT_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const RAZORPAY_ORDER_ID_PATTERN = /^order_[A-Za-z0-9]+$/;
const RAZORPAY_PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]+$/;

function assertCheckoutInput(input: RazorpayCheckoutInput) {
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

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () =>
        resolve(Boolean(window.Razorpay)),
      );
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export type RazorpayCheckoutInput = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  paymentMethod?: CheckoutPaymentMethodId;
  /** Opens Razorpay with default blocks so Apple Pay is available when eligible. */
  expressCheckout?: "apple_pay";
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
};

export async function openRazorpayCheckout(input: RazorpayCheckoutInput) {
  assertCheckoutInput(input);

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Could not load Razorpay checkout.");
  }

  const paymentMethod = input.paymentMethod ?? "card";
  const prefill = input.prefill ?? {};
  const isApplePayExpress = input.expressCheckout === "apple_pay";

  const checkoutOptions: Record<string, unknown> = {
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    name: input.name ?? "Clauxen",
    description: input.description,
    order_id: input.orderId,
    prefill,
    config: isApplePayExpress
      ? buildRazorpayConfigForExpressCheckout()
      : buildRazorpayConfigForMethod(paymentMethod),
    theme: { color: "#141413" },
  };

  if (!isApplePayExpress && paymentMethod === "card" && prefill.email && prefill.contact) {
    checkoutOptions.method = "card";
  }

  return new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      ...checkoutOptions,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          assertPaymentResponse(response);
          await input.onSuccess(response);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => {
          input.onDismiss?.();
          resolve();
        },
      },
    });
    rzp.open();
  });
}

export type { CheckoutPaymentMethodId };
