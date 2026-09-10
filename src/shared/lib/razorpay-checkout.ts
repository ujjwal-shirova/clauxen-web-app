import {
  buildRazorpayConfigForAllStandardMethods,
  buildRazorpayConfigForExpressCheckout,
  buildRazorpayConfigForMethod,
  buildRazorpayConfigForNetbankingBank,
  type CheckoutPaymentMethodId,
} from "@/lib/razorpay-payment-methods";
import { isActivatedNetbankingBank } from "@/lib/razorpay-netbanking-banks";
import { normalizeIndianMobileContact } from "@/lib/razorpay-custom-checkout";

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
const RAZORPAY_CUSTOM_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/razorpay.js";
const RAZORPAY_KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const RAZORPAY_ORDER_ID_PATTERN = /^order_[A-Za-z0-9]+$/;
const RAZORPAY_PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]+$/;

function assertCheckoutInput(input: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  /** Mandate / save-instrument setup may authorize ₹0. */
  allowZeroAmount?: boolean;
}) {
  if (!RAZORPAY_KEY_ID_PATTERN.test(input.keyId)) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
  if (!RAZORPAY_ORDER_ID_PATTERN.test(input.orderId)) {
    throw new Error("Invalid Razorpay checkout configuration.");
  }
  const minAmount = input.allowZeroAmount ? 0 : 1;
  if (!Number.isInteger(input.amount) || input.amount < minAmount) {
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

function removeRazorpayScripts(urls: string[]) {
  if (typeof document === "undefined") return;
  for (const url of urls) {
    document
      .querySelectorAll(`script[src="${url}"]`)
      .forEach((el) => el.remove());
  }
}

/** True when Standard Checkout (`checkout.js`) is present and Custom is not. */
function hasCleanStandardCheckoutScript(): boolean {
  if (typeof document === "undefined") return false;
  const hasCustom = Boolean(
    document.querySelector(`script[src="${RAZORPAY_CUSTOM_SCRIPT_URL}"]`),
  );
  const hasStandard = Boolean(
    document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`),
  );
  return hasStandard && !hasCustom && Boolean(window.Razorpay);
}

/**
 * Ensure Standard Checkout script is the active `window.Razorpay`.
 * Custom Checkout (`razorpay.js`) overwrites the same global — strip it and
 * re-inject Standard when needed (e.g. after Card tab used Custom Checkout).
 */
export async function ensureStandardRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (hasCleanStandardCheckoutScript()) {
    return true;
  }

  // Custom Checkout shares `window.Razorpay` — remove it before loading Standard.
  removeRazorpayScripts([
    RAZORPAY_CUSTOM_SCRIPT_URL,
    RAZORPAY_CHECKOUT_SCRIPT_URL,
  ]);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.setAttribute("fetchpriority", "high");
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function loadRazorpayScript(): Promise<boolean> {
  return ensureStandardRazorpayScript();
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
  allowZeroAmount?: boolean;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
};

export type RazorpayNetbankingCheckoutInput = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  bank: string;
  email: string;
  contact?: string;
  name?: string;
  description?: string;
  onSuccess: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  onDismiss?: () => void;
};

export async function openRazorpayCheckout(input: RazorpayCheckoutInput) {
  assertCheckoutInput(input);

  const loaded = await ensureStandardRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Could not load Razorpay checkout.");
  }

  const paymentMethod = input.paymentMethod ?? "card";
  const prefill = input.prefill ?? {};
  const isApplePayExpress = input.expressCheckout === "apple_pay";

  const useFullMethods =
    isApplePayExpress || paymentMethod === "card" || !input.paymentMethod;

  const checkoutOptions: Record<string, unknown> = {
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    name: input.name ?? "Shirova",
    description: input.description,
    order_id: input.orderId,
    prefill,
    config: isApplePayExpress
      ? buildRazorpayConfigForExpressCheckout()
      : useFullMethods
        ? buildRazorpayConfigForAllStandardMethods()
        : buildRazorpayConfigForMethod(paymentMethod),
    theme: { color: "#141413" },
  };

  if (
    !isApplePayExpress &&
    paymentMethod === "card" &&
    prefill.email &&
    prefill.contact
  ) {
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

/**
 * Netbanking via Standard Checkout modal (stays on checkout page).
 * Custom Checkout createPayment is unreliable for netbanking (stuck on
 * "Loading your bank page" when the secondary bank popup never opens).
 *
 * @see https://razorpay.com/docs/payments/payment-methods/netbanking/
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/
 */
export async function openRazorpayNetbankingCheckout(
  input: RazorpayNetbankingCheckoutInput,
): Promise<void> {
  assertCheckoutInput(input);

  const bank = input.bank.trim().toUpperCase();
  if (!isActivatedNetbankingBank(bank)) {
    throw new Error("Select a supported bank to continue.");
  }

  const contact = normalizeIndianMobileContact(input.contact ?? "");

  const email = input.email.trim();
  if (!email) {
    throw new Error("Email is required to complete netbanking payment.");
  }

  const loaded = await ensureStandardRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Could not load Razorpay checkout.");
  }

  // Prefill method+bank (docs): with email+contact, Checkout skips method
  // picker and opens the selected bank. Config locks display to that bank only.
  // @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
  return new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: input.name ?? "Shirova",
      description: input.description,
      order_id: input.orderId,
      method: "netbanking",
      prefill: {
        email,
        ...(contact ? { contact } : {}),
        method: "netbanking",
        bank,
      },
      config: buildRazorpayConfigForNetbankingBank(bank),
      theme: {
        color: "#18181b",
        // Keep customers on the selected bank (no switch back to other methods).
        hide_topbar: true,
      },
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
