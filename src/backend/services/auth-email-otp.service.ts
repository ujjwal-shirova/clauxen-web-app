import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/backend/config/env";
import { AppError } from "@/backend/db/errors";
import { queryOne } from "@/backend/db/pool";
import { assertEmailNotDisposable } from "@/backend/email-verifier/disposable-email";
import { ensureUserRecord } from "@/backend/services/identity.service";
import { getSupabaseAdmin } from "@/backend/infrastructure/supabase/server";

const MAX_EMAIL_LEN = 320;
const MAX_PASSWORD_LEN = 128;
const MIN_PASSWORD_LEN = 8;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, MAX_EMAIL_LEN);
}

function assertEmailShape(email: string) {
  if (!email || !email.includes("@") || email.length > MAX_EMAIL_LEN) {
    throw new AppError("Enter a valid email address.", 400, "invalid_email");
  }
  assertEmailNotDisposable(email);
}

export async function authEmailExists(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  assertEmailShape(normalized);

  const authRow = await queryOne<{ id: string }>(
    `select id from auth.users where lower(email) = lower($1) limit 1`,
    [normalized],
  );
  if (authRow?.id) return true;

  const profile = await queryOne<{ id: string }>(
    `select id from public.profiles where lower(email) = lower($1) limit 1`,
    [normalized],
  );
  return Boolean(profile?.id);
}

async function callAuthEmailWorker<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const base = env.authEmailWorkerUrl;
  const token = env.authEmailInternalToken;
  if (!base || !token) {
    throw new AppError(
      "Email verification is not configured. Set AUTH_EMAIL_WORKER_URL and AUTH_EMAIL_INTERNAL_TOKEN.",
      503,
      "auth_email_unconfigured",
    );
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-clauxen-internal": token,
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!res.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "Verification request failed.";
    throw new AppError(message, res.status, String(payload.error ?? "otp_error"));
  }

  return payload as T;
}

/** Local/dev fallback when Worker is unset but AUTH_DEV_BYPASS is on. */
const localOtpStore = new Map<
  string,
  { hash: string; salt: string; expiresAt: number; attempts: number }
>();
const localTickets = new Map<
  string,
  { email: string; expiresAt: number }
>();

function hashLocal(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function localDigits() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestSignupOtp(email: string): Promise<{
  ok: true;
  expiresInSeconds: number;
  delivered: boolean;
  simulated?: boolean;
  debugCode?: string;
}> {
  const normalized = normalizeEmail(email);
  assertEmailShape(normalized);

  if (await authEmailExists(normalized)) {
    throw new AppError(
      "An account with this email already exists. Sign in instead.",
      409,
      "email_exists",
    );
  }

  if (env.authEmailWorkerUrl && env.authEmailInternalToken) {
    const result = await callAuthEmailWorker<{
      ok: true;
      expiresInSeconds: number;
      delivered: boolean;
      simulated?: boolean;
      debugCode?: string;
    }>("/v1/otp/send", { email: normalized });
    return {
      ok: true,
      expiresInSeconds: result.expiresInSeconds,
      delivered: result.delivered,
      simulated: result.simulated,
      ...(env.authDevBypass && result.debugCode
        ? { debugCode: result.debugCode }
        : {}),
    };
  }

  if (!env.authDevBypass) {
    throw new AppError(
      "Email verification is not configured.",
      503,
      "auth_email_unconfigured",
    );
  }

  // Dev bypass: keep OTP in-process so local signup works without Worker.
  const code = localDigits();
  const salt = randomBytes(8).toString("hex");
  localOtpStore.set(normalized, {
    hash: hashLocal(code, salt),
    salt,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  console.info(`[auth-email:dev] OTP for ${normalized}: ${code}`);
  return {
    ok: true,
    expiresInSeconds: 600,
    delivered: false,
    simulated: true,
    debugCode: code,
  };
}

export async function verifySignupOtp(input: {
  email: string;
  code: string;
}): Promise<{ signupTicket: string; email: string }> {
  const normalized = normalizeEmail(input.email);
  assertEmailShape(normalized);
  const code = String(input.code ?? "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) {
    throw new AppError("Enter the 6-digit code.", 400, "invalid_code");
  }

  if (env.authEmailWorkerUrl && env.authEmailInternalToken) {
    const result = await callAuthEmailWorker<{
      ok: true;
      signupTicket: string;
      email: string;
    }>("/v1/otp/verify", { email: normalized, code });
    return { signupTicket: result.signupTicket, email: result.email };
  }

  if (!env.authDevBypass) {
    throw new AppError(
      "Email verification is not configured.",
      503,
      "auth_email_unconfigured",
    );
  }

  const record = localOtpStore.get(normalized);
  if (!record || record.expiresAt < Date.now()) {
    localOtpStore.delete(normalized);
    throw new AppError("Code expired. Request a new one.", 400, "expired");
  }
  if (record.attempts >= 5) {
    localOtpStore.delete(normalized);
    throw new AppError(
      "Too many attempts. Request a new code.",
      429,
      "too_many_attempts",
    );
  }
  const candidate = hashLocal(code, record.salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(record.hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    record.attempts += 1;
    throw new AppError("Incorrect code. Try again.", 400, "invalid_code");
  }
  localOtpStore.delete(normalized);
  const ticket = randomBytes(24).toString("hex");
  localTickets.set(ticket, {
    email: normalized,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return { signupTicket: ticket, email: normalized };
}

async function consumeSignupTicket(email: string, ticket: string) {
  const normalized = normalizeEmail(email);

  if (env.authEmailWorkerUrl && env.authEmailInternalToken) {
    await callAuthEmailWorker("/v1/otp/consume-ticket", {
      email: normalized,
      ticket,
    });
    return;
  }

  if (!env.authDevBypass) {
    throw new AppError(
      "Email verification is not configured.",
      503,
      "auth_email_unconfigured",
    );
  }

  const record = localTickets.get(ticket);
  if (!record || record.email !== normalized || record.expiresAt < Date.now()) {
    throw new AppError("Verification expired. Start again.", 400, "invalid_ticket");
  }
  localTickets.delete(ticket);
}

export async function createAccountAfterOtp(input: {
  email: string;
  password: string;
  signupTicket: string;
}): Promise<{ email: string; userId: string }> {
  const normalized = normalizeEmail(input.email);
  assertEmailShape(normalized);

  const password = input.password.slice(0, MAX_PASSWORD_LEN);
  if (password.length < MIN_PASSWORD_LEN) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
      400,
      "weak_password",
    );
  }

  await consumeSignupTicket(normalized, input.signupTicket);

  if (await authEmailExists(normalized)) {
    throw new AppError(
      "An account with this email already exists. Sign in instead.",
      409,
      "email_exists",
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new AppError(
      error?.message || "Could not create account.",
      400,
      "signup_failed",
    );
  }

  await ensureUserRecord({
    userId: data.user.id,
    email: normalized,
  });

  return { email: normalized, userId: data.user.id };
}
