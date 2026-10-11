import { combineChunks, stringFromBase64URL } from "@supabase/ssr";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwksCache,
  jwtVerify,
  type JWKSCacheInput,
  type JWTPayload,
} from "jose";
import { AppError } from "@/server/db/errors";
import { getSupabaseUrl } from "@/utils/supabase/env";

/**
 * Local Supabase access-token verification.
 *
 * The project signs access tokens with an asymmetric ES256 key, so identity can
 * be established by verifying the JWT against the project's JWKS — no network
 * round-trip to GoTrue per request. The JWKS is fetched once per isolate and
 * cached as public JSON keys (with refetch on unknown `kid` for key rotation).
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

// Cache public JSON keys only: pending network I/O must belong to one Worker request.
let publicKeys: JWKSCacheInput = {};
let issuer: string | null = null;
let secretKeyBytes: Uint8Array | null = null;

// Lightweight in-memory cache of verified tokens to avoid re-verifying on rapid sequential requests
const tokenCache = new Map<
  string,
  { claims: SupabaseJwtClaims; expiresAt: number }
>();

function getSecretBytes(): Uint8Array | null {
  if (secretKeyBytes) return secretKeyBytes;
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (secret) {
    secretKeyBytes = new TextEncoder().encode(secret);
    return secretKeyBytes;
  }
  return null;
}

function verifierConfig(): {
  jwks: ReturnType<typeof createRemoteJWKSet>;
  issuer: string;
} | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  const base = url.replace(/\/+$/, "");
  const nextIssuer = `${base}/auth/v1`;
  if (issuer !== nextIssuer) {
    publicKeys = {};
    tokenCache.clear();
    issuer = nextIssuer;
  }
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
    [jwksCache]: publicKeys,
    cacheMaxAge: 15 * 60 * 1000,
    cooldownDuration: 30 * 1000,
    timeoutDuration: 5_000,
  });
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
    return typeof session.access_token === "string"
      ? session.access_token
      : null;
  } catch {
    return null;
  }
}

/** Clear claims cache on logout or account deletion */
export function clearTokenClaimsCache(userId?: string) {
  if (!userId) {
    tokenCache.clear();
    return;
  }
  for (const [key, entry] of tokenCache.entries()) {
    if (entry.claims.sub === userId) {
      tokenCache.delete(key);
    }
  }
}

/** Verify signature, issuer and expiry. Returns null for any invalid token. */
export async function verifyAccessToken(
  token: string,
): Promise<SupabaseJwtClaims | null> {
  if (!token || typeof token !== "string") return null;

  const config = verifierConfig();
  // Check in-memory fast cache first
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.claims;
  }

  const secretBytes = getSecretBytes();

  let payload: JWTPayload | null = null;

  let algorithm: string | undefined;
  try {
    algorithm = decodeProtectedHeader(token).alg;
  } catch {
    return null;
  }
  const options = {
    clockTolerance: 10,
    audience: "authenticated",
    issuer: config ? [config.issuer, "supabase"] : "supabase",
    requiredClaims: ["sub", "exp", "iss", "aud"],
  };

  if (algorithm === "HS256") {
    if (!secretBytes) return null;
    try {
      payload = (
        await jwtVerify(token, secretBytes, {
          ...options,
          algorithms: ["HS256"],
        })
      ).payload;
    } catch {
      return null;
    }
  } else if (config && (algorithm === "ES256" || algorithm === "RS256")) {
    try {
      payload = (
        await jwtVerify(token, config.jwks, {
          ...options,
          algorithms: ["ES256", "RS256"],
        })
      ).payload;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ERR_JWKS_TIMEOUT" || code === "ERR_JOSE_GENERIC" || !code) {
        throw new AppError(
          "Session verification is temporarily unavailable. Please retry.",
          503,
          "auth_unavailable",
        );
      }
      return null;
    }
  }

  if (!payload) return null;

  // Validate issuer: accepts project-specific URL or standard "supabase"
  const iss = payload.iss;
  if (config && iss && iss !== config.issuer && iss !== "supabase") {
    return null;
  }

  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (payload.role !== "authenticated") return null;

  const claims = payload as SupabaseJwtClaims;

  // Cache valid token for up to 60s or until token expiry
  const tokenExpMs =
    typeof claims.exp === "number" ? claims.exp * 1000 : now + 60_000;
  const ttl = Math.min(now + 60_000, tokenExpMs);
  if (ttl > now) {
    tokenCache.set(token, { claims, expiresAt: ttl });
    // Keep cache bounded
    if (tokenCache.size > 1000) {
      const firstKey = tokenCache.keys().next().value;
      if (firstKey) tokenCache.delete(firstKey);
    }
  }

  return claims;
}

export async function getClaimsFromCookies(
  cookies: CookieReader,
): Promise<SupabaseJwtClaims | null> {
  const token = await readAccessTokenFromCookies(cookies);
  return token ? verifyAccessToken(token) : null;
}
