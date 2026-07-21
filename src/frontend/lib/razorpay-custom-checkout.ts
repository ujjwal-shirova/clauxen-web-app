/**
 * Razorpay Custom Checkout — card / netbanking data stays in the browser and
 * is sent only to Razorpay via razorpay.js createPayment (never to our /api).
 *
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/custom/build-integration/
 * Netbanking: method "netbanking" + bank code (e.g. CNRB).
 *
 * Important: createPayment must run in the same user-gesture turn as the Pay
 * click for netbanking (bank auth uses a browser popup). Prefetch the script
 * and order first; never await network before createPayment or the popup
 * opens then is closed by the browser.
 */
import { cardNumberDigits } from "@/frontend/lib/card-input-format";
import { isActivatedNetbankingBank } from "@/lib/razorpay-netbanking-banks";

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

/** Keep the active Custom Checkout instance reachable so GC cannot kill the bank frame. */
let activeCustomCheckout: RazorpayCustomInstance | null = null;

export type CustomCardDetails = {
  /** Digits only or formatted — we strip non-digits. */
  number: string;
  name: string;
  /** Formatted MM / YY or digits MMYY */
  expiry: string;
  cvc: string;
};

type RazorpayCustomSuccessPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCustomBasePaymentInput = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  email?: string;
  contact?: string;
  description?: string;
  onSuccess: (payload: RazorpayCustomSuccessPayload) => void | Promise<void>;
  onFailure?: (message: string) => void;
};

export type RazorpayCustomCardPaymentInput = RazorpayCustomBasePaymentInput & {
  card: CustomCardDetails;
};

export type RazorpayCustomNetbankingPaymentInput =
  RazorpayCustomBasePaymentInput & {
    /** Razorpay bank code from activated netbanking list (e.g. `CNRB`). */
    bank: string;
    /** Indian mobile as +91XXXXXXXXXX — required for live netbanking. */
    contact: string;
  };

function assertCheckoutInput(input: RazorpayCustomBasePaymentInput) {
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

export function isRazorpayCustomScriptReady(): boolean {
  return Boolean(getRazorpayCustomCtor());
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

function attachPaymentHandlers(
  razorpay: RazorpayCustomInstance,
  input: RazorpayCustomBasePaymentInput,
  resolve: () => void,
  reject: (error: Error) => void,
) {
  razorpay.on("payment.success", async (response: unknown) => {
    try {
      const payload = response as RazorpayCustomSuccessPayload;
      assertPaymentResponse(payload);
      await input.onSuccess(payload);
      activeCustomCheckout = null;
      resolve();
    } catch (error) {
      activeCustomCheckout = null;
      reject(error instanceof Error ? error : new Error("Payment verification failed."));
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
    activeCustomCheckout = null;
    input.onFailure?.(message);
    reject(new Error(message));
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
    name: "Shirova",
    description: input.description,
    // Keep bank OTP / 3DS in a minimal frame — never open Standard Checkout UI.
    theme: { color: "#18181b", backdrop_color: "#00000066" },
  });
  activeCustomCheckout = razorpay;

  return new Promise<void>((resolve, reject) => {
    attachPaymentHandlers(razorpay, input, resolve, reject);

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
      activeCustomCheckout = null;
      reject(
        error instanceof Error
          ? error
          : new Error("Could not start card payment."),
      );
    }
  });
}

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Normalize to Razorpay contact format `+91XXXXXXXXXX`. */
export function normalizeIndianMobileContact(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (!INDIAN_MOBILE_RE.test(local)) return null;
  return `+91${local}`;
}

/**
 * Start netbanking via Custom Checkout popup (stay on checkout page).
 *
 * Prefetch order + `razorpay.js` first; call this from the Pay click with no
 * awaits before it so the bank loader popup stays in the user-gesture turn.
 * Always pass a valid `contact` — live netbanking fails immediately without it
 * (shows PAYMENT FAILED / closes the popup).
 */
export function startNetbankingWithRazorpayCustom(
  input: RazorpayCustomNetbankingPaymentInput,
): Promise<void> {
  assertCheckoutInput(input);

  const bank = input.bank.trim().toUpperCase();
  if (!isActivatedNetbankingBank(bank)) {
    return Promise.reject(new Error("Select a supported bank to continue."));
  }

  const contact = normalizeIndianMobileContact(input.contact);
  if (!contact) {
    return Promise.reject(
      new Error("Enter a valid 10-digit Indian mobile number."),
    );
  }

  const RazorpayCtor = getRazorpayCustomCtor();
  if (!RazorpayCtor) {
    return Promise.reject(
      new Error("Razorpay checkout is not ready. Please try again."),
    );
  }

  const email = input.email?.trim();
  if (!email) {
    return Promise.reject(
      new Error("Email is required to complete netbanking payment."),
    );
  }

  const razorpay = new RazorpayCtor({
    key: input.keyId,
    name: "Shirova",
    description: input.description,
    theme: { color: "#18181b", backdrop_color: "#00000066" },
  });
  activeCustomCheckout = razorpay;

  return new Promise<void>((resolve, reject) => {
    attachPaymentHandlers(razorpay, input, resolve, reject);

    try {
      // Sync relative to Pay click — do not await network above this call.
      razorpay.createPayment({
        amount: input.amount,
        currency: input.currency,
        order_id: input.orderId,
        email,
        contact,
        method: "netbanking",
        bank,
      });
    } catch (error) {
      activeCustomCheckout = null;
      reject(
        error instanceof Error
          ? error
          : new Error("Could not start netbanking payment."),
      );
    }
  });
}

/**
 * @deprecated Prefer prefetch + {@link startNetbankingWithRazorpayCustom}.
 */
export async function chargeNetbankingWithRazorpayCustom(
  input: RazorpayCustomNetbankingPaymentInput,
): Promise<void> {
  const loaded = await loadRazorpayCustomScript();
  if (!loaded) {
    throw new Error("Could not load Razorpay checkout.");
  }
  return startNetbankingWithRazorpayCustom(input);
}
