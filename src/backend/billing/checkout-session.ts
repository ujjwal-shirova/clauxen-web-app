import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "@/backend/db/errors";
import { env } from "@/backend/config/env";
import {
  isCheckoutCurrency,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";

export const CHECKOUT_MERCHANT = "shirova";

export type CheckoutSessionClaims = {
  uid: string;
  planId: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  currency?: CheckoutCurrency;
  maxTier?: string;
  seatBreakdown?: Record<string, number>;
  organizationSeatCount?: number;
  /** Soft-nav path after successful payment (e.g. /new or /c/…). */
  returnPath?: string;
  iat: number;
  exp: number;
};

const SESSION_PREFIX = "cs_live_";
const SESSION_TTL_SECONDS = 30 * 60;

function signingKey(): string {
  const key =
    env.razorpayKeySecret ||
    env.razorpayWebhookSecret ||
    env.jwtSecret;
  if (!key) {
    throw new AppError(
      "Checkout session signing is not configured.",
      503,
      "billing_unavailable",
    );
  }
  return key;
}

function signBody(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

function secureEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(actual, "utf8"),
    );
  } catch {
    return false;
  }
}

export function mintCheckoutSessionToken(
  input: Omit<CheckoutSessionClaims, "iat" | "exp">,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const claims: CheckoutSessionClaims = {
    ...input,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = signBody(body);
  return `${SESSION_PREFIX}${body}.${signature}`;
}

export function verifyCheckoutSessionToken(
  token: string,
): CheckoutSessionClaims {
  if (!token.startsWith(SESSION_PREFIX)) {
    throw new AppError("Invalid checkout session.", 400, "invalid_session");
  }

  const rest = token.slice(SESSION_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) {
    throw new AppError("Invalid checkout session.", 400, "invalid_session");
  }

  const body = rest.slice(0, dot);
  const signature = rest.slice(dot + 1);
  const expected = signBody(body);

  if (!secureEqual(expected, signature)) {
    throw new AppError("Invalid checkout session.", 400, "invalid_session");
  }

  let claims: CheckoutSessionClaims;
  try {
    claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as CheckoutSessionClaims;
  } catch {
    throw new AppError("Invalid checkout session.", 400, "invalid_session");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !claims.uid ||
    !claims.planId ||
    !claims.planName ||
    (claims.billingCycle !== "monthly" && claims.billingCycle !== "yearly") ||
    (claims.currency != null && !isCheckoutCurrency(claims.currency)) ||
    claims.exp < now
  ) {
    throw new AppError("Checkout session has expired.", 410, "session_expired");
  }

  return claims;
}

export function checkoutSessionPath(
  token: string,
  merchant: string = CHECKOUT_MERCHANT,
) {
  return `/checkout/${merchant}/${token}`;
}

const SAFE_RETURN_PATH =
  /^\/(?:new|onboarding|c\/[A-Za-z0-9_-]+|library|projects(?:\/[A-Za-z0-9_-]+)?|customize)?\/?$/;

/** Sanitize client-provided return path; fall back to /new. */
export function normalizeCheckoutReturnPath(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "/new";
  const path = raw.trim().split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return "/new";
  if (path === "/" || path === "/new" || path === "/new/") return "/new";
  if (SAFE_RETURN_PATH.test(path)) return path.replace(/\/$/, "") || "/new";
  return "/new";
}
