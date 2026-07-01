import { apiFetch } from "@/frontend/lib/api/client";

const MAX_LOGIN_EMAIL_LEN = 320;
const MAX_LOGIN_PASSWORD_LEN = 128;
const MAX_REGISTER_DISPLAY_NAME_LEN = 120;

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
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
