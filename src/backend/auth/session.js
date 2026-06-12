import { createHmac, timingSafeEqual } from "crypto";
import { env, isOryConfigured } from "@/backend/config/env";
import { queryOne } from "@/backend/db/pool";
import { resolveUserIdFromApiKey } from "@/backend/repositories/api-keys.repository";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return UUID_RE.test(value);
}
function sessionSigningSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret || null;
}
function signUserId(userId) {
  const secret = sessionSigningSecret();
  if (!secret) return userId;
  const sig = createHmac("sha256", secret).update(userId).digest("base64url");
  return `${userId}.${sig}`;
}
function parseSignedSessionCookie(raw) {
  const secret = sessionSigningSecret();
  if (!secret) {
    return isUuid(raw) ? raw : null;
  }
  const dot = raw.lastIndexOf(".");
  if (dot === -1) {
    if (process.env.NODE_ENV === "production") return null;
    return isUuid(raw) ? raw : null;
  }
  const userId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!isUuid(userId) || !sig) return null;
  const expected = createHmac("sha256", secret)
    .update(userId)
    .digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}
// Ory Kratos public API — browser session cookies validate
async function getKratosSession(request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader || !env.oryKratosPublicUrl) return null;
  const response = await fetch(`${env.oryKratosPublicUrl}/sessions/whoami`, {
    headers: { cookie: cookieHeader }, // Kratos session cookie forward
    cache: "no-store",
  });
  if (!response.ok) return null; // 401/403 — logged out
  const body = await response.json();
  const id = body.identity?.id;
  if (!id) return null;
  const email = body.identity?.traits?.email ?? null;
  const first = body.identity?.traits?.name?.first ?? "";
  const last = body.identity?.traits?.name?.last ?? "";
  const displayName = `${first} ${last}`.trim() || email;
  return {
    id,
    email,
    displayName,
    avatarUrl: null,
  };
}
async function profileForUserId(userId) {
  const profile = await queryOne(
    `select id, email, display_name, avatar_url from public.profiles where id = $1`,
    [userId],
  );
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  };
}
// programmatic access — Authorization: Bearer clx_…
async function getBearerApiKeySession(request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const userId = await resolveUserIdFromApiKey(token);
  if (!userId) return null;
  return profileForUserId(userId);
}
// dev/simple auth — HttpOnly cookie; signed when SESSION_SECRET is set
async function getCookieSession(request) {
  const raw = request.cookies.get(env.sessionCookieName)?.value;
  if (!raw) return null;
  const userId = parseSignedSessionCookie(raw);
  if (!userId) return null;
  return profileForUserId(userId);
}
export async function getSessionFromRequest(request) {
  const apiKeySession = await getBearerApiKeySession(request);
  if (apiKeySession) return apiKeySession;
  if (isOryConfigured()) {
    const orySession = await getKratosSession(request);
    if (orySession) return orySession;
  }
  return getCookieSession(request);
}
export function sessionCookieHeader(userId) {
  if (!isUuid(userId)) {
    throw new Error("Invalid session user id");
  }
  const maxAge = 60 * 60 * 24 * 30; // 30 days seconds
  const secure = env.appUrl.startsWith("https") ? "; Secure" : "";
  const value = signUserId(userId);
  return `${env.sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
export function clearSessionCookieHeader() {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
