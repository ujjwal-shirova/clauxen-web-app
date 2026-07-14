import { apiFetch } from "@/frontend/lib/api/client";

const MAX_LOGIN_EMAIL_LEN = 320;
const MAX_LOGIN_PASSWORD_LEN = 128;
const MAX_REGISTER_DISPLAY_NAME_LEN = 120;

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().slice(0, MAX_LOGIN_EMAIL_LEN);
}

function assertNonEmptyEmail(email: string) {
  if (!email) {
    throw new Error("Email is required.");
  }
}

export async function getSession() {
  const data = await apiFetch<{ session: SessionUser | null }>(
    "/api/v1/auth/session",
  );
  return data.session;
}

export async function login(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  assertNonEmptyEmail(normalizedEmail);
  const safePassword = password.slice(0, MAX_LOGIN_PASSWORD_LEN);
  return apiFetch<{ user: SessionUser }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: normalizedEmail, password: safePassword }),
  });
}

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  assertNonEmptyEmail(normalizedEmail);
  const safePassword = input.password.slice(0, MAX_LOGIN_PASSWORD_LEN);
  const displayName =
    typeof input.displayName === "string"
      ? input.displayName.trim().slice(0, MAX_REGISTER_DISPLAY_NAME_LEN)
      : undefined;
  return apiFetch<{ user: SessionUser }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: normalizedEmail,
      password: safePassword,
      ...(displayName ? { displayName } : {}),
    }),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
}

/** Server-enforced disposable/temp email gate (cannot be bypassed via DevTools alone). */
export async function validateEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  assertNonEmptyEmail(normalizedEmail);
  return apiFetch<{ ok: true; code: string }>("/api/v1/auth/validate-email", {
    method: "POST",
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

/** Check whether email already has an account (login vs create). */
export async function checkEmailStatus(email: string) {
  const normalizedEmail = normalizeEmail(email);
  assertNonEmptyEmail(normalizedEmail);
  return apiFetch<{
    email: string;
    exists: boolean;
    mode: "login" | "create";
  }>("/api/v1/auth/email-status", {
    method: "POST",
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

/** Send signup OTP via Cloudflare auth-email Worker. */
export async function requestSignupOtp(email: string) {
  const normalizedEmail = normalizeEmail(email);
  assertNonEmptyEmail(normalizedEmail);
  return apiFetch<{
    ok: true;
    expiresInSeconds: number;
    delivered: boolean;
    simulated?: boolean;
    debugCode?: string;
  }>("/api/v1/auth/signup/request-otp", {
    method: "POST",
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

/** Verify OTP and create the confirmed account; then client signs in. */
export async function verifySignupAndCreate(input: {
  email: string;
  code: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  assertNonEmptyEmail(normalizedEmail);
  const safePassword = input.password.slice(0, MAX_LOGIN_PASSWORD_LEN);
  return apiFetch<{ ok: true; email: string; userId: string }>(
    "/api/v1/auth/signup/verify",
    {
      method: "POST",
      body: JSON.stringify({
        email: normalizedEmail,
        code: input.code.replace(/\D/g, "").slice(0, 6),
        password: safePassword,
      }),
    },
  );
}
