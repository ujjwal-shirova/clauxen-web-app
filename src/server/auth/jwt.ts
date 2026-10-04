import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getSupabaseUrl } from "@/utils/supabase/env";

/**
 * Local Supabase access-token verification.
 *
 * The project signs access tokens with an asymmetric ES256 key, so identity can
 * be established by verifying the JWT against the project's JWKS — no network
 * round-trip to GoTrue per request. The JWKS is fetched once per isolate and
 * cached by `jose` (with automatic refetch on unknown `kid` for key rotation).
 *
 * This module never refreshes tokens. An expired token yields `null`; the
 * browser client owns refresh (it holds the refresh token and persists the new
 * cookie), which removes the server-side refresh storm entirely.
 *
 * Edge-safe: used by both `proxy.ts` and Node route handlers.
 */

export type SupabaseJwtClaims = JWTPayload & {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  session_id?: string;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type CookieReader = { getAll(): { name: string; value: string }[] };

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let issuer: string | null = null;

function verifierConfig(): { jwks: ReturnType<typeof createRemoteJWKSet>; issuer: string } | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  if (!jwks || !issuer) {
    const base = url.replace(/\/+$/, "");
    issuer = `${base}/auth/v1`;
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      timeoutDuration: 5_000,
    });
  }
  return { jwks, issuer };
}

/** `sb-<project-ref>-auth-token` — @supabase/ssr default storage key. */
function authCookieKey(): string | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** Read the access token from the (possibly chunked, base64-) session cookie. */
export async function readAccessTokenFromCookies(
  cookies: CookieReader,
): Promise<string | null> {
  const key = authCookieKey();
  if (!key) return null;
  const all = cookies.getAll();
  const raw = await combineChunks(
    key,
    (name) => all.find((cookie) => cookie.name === name)?.value ?? null,
  );
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-")
      ? stringFromBase64URL(raw.slice("base64-".length))
      : raw;
    const session = JSON.parse(json) as { access_token?: unknown };
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

/** Verify signature, issuer and expiry. Returns null for any invalid token. */
export async function verifyAccessToken(
  token: string,
): Promise<SupabaseJwtClaims | null> {
  const config = verifierConfig();
  if (!config || !token) return null;
  try {
    const { payload } = await jwtVerify(token, config.jwks, {
      issuer: config.issuer,
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (payload.role && payload.role !== "authenticated") return null;
    return payload as SupabaseJwtClaims;
  } catch {
    return null;
  }
}

export async function getClaimsFromCookies(
  cookies: CookieReader,
): Promise<SupabaseJwtClaims | null> {
  const token = await readAccessTokenFromCookies(cookies);
  return token ? verifyAccessToken(token) : null;
}
