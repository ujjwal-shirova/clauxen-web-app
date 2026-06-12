import { env } from "@/backend/config/env";

const STATE_COOKIE = "clauxen_oauth_state";
const VERIFIER_COOKIE = "clauxen_oauth_verifier";

function cookieBase(maxAge: number, secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

function isSecure(): boolean {
  return env.appUrl.startsWith("https");
}

export function oauthStateCookieHeader(
  state: string,
  verifier: string,
): string[] {
  const base = cookieBase(600, isSecure());
  return [
    `${STATE_COOKIE}=${state}${base}`,
    `${VERIFIER_COOKIE}=${verifier}${base}`,
  ];
}

export function clearOAuthCookiesHeader(): string[] {
  const base = cookieBase(0, isSecure());
  return [`${STATE_COOKIE}=${base}`, `${VERIFIER_COOKIE}=${base}`];
}

export function readOAuthCookies(cookieHeader: string | null): {
  state: string | null;
  verifier: string | null;
} {
  if (!cookieHeader) return { state: null, verifier: null };

  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) map.set(name, rest.join("="));
  }

  return {
    state: map.get(STATE_COOKIE) ?? null,
    verifier: map.get(VERIFIER_COOKIE) ?? null,
  };
}
