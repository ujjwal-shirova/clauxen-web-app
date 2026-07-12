import type { NextRequest } from "next/server";
import { env } from "@/backend/config/env";
import { queryOne } from "@/backend/db/pool";
import { resolveUserIdFromApiKey } from "@/backend/repositories/api-keys.repository";
import {
  createSupabaseClientFromRequest,
  getSupabaseUserIdFromRequest,
} from "@/backend/auth/supabase-session";
import { resolveAuthAvatarUrl, resolveAuthFullName } from "@/lib/profile-names";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
};

async function profileForUserId(userId: string): Promise<SessionUser | null> {
  try {
    const profile = await queryOne<{
      id: string;
      email: string | null;
      display_name: string | null;
      preferred_name: string | null;
      avatar_url: string | null;
    }>(
      `select id, email, display_name, preferred_name, avatar_url
       from public.profiles where id = $1`,
      [userId],
    );

    if (!profile) return null;

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      preferredName: profile.preferred_name,
      avatarUrl: profile.avatar_url,
    };
  } catch (err) {
    console.warn("[session] profile lookup failed:", err);
    return null;
  }
}

function sessionFromAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  phone?: string | null;
}): SessionUser {
  const email = user.email?.trim() || null;
  const meta = user.user_metadata ?? null;
  const preferred =
    typeof meta?.preferred_name === "string"
      ? meta.preferred_name.trim() || null
      : null;
  return {
    id: user.id,
    email,
    displayName: resolveAuthFullName(meta) ?? email?.split("@")[0] ?? null,
    preferredName: preferred,
    avatarUrl: resolveAuthAvatarUrl(meta),
  };
}

function mergeProfilePreferred(
  profile: SessionUser | null,
  fallback: SessionUser,
): SessionUser {
  if (!profile) return fallback;
  return {
    id: profile.id,
    email: profile.email ?? fallback.email,
    displayName: profile.displayName ?? fallback.displayName,
    preferredName: profile.preferredName ?? fallback.preferredName,
    avatarUrl: profile.avatarUrl ?? fallback.avatarUrl,
  };
}

async function getBearerApiKeySession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const userId = await resolveUserIdFromApiKey(token);
  if (!userId) return null;

  return profileForUserId(userId);
}

async function getCookieSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const session = request.cookies.get(env.sessionCookieName)?.value;
  if (!session) return null;
  return profileForUserId(session);
}

/**
 * Prefer DB profile; if missing/unreachable, still return JWT claims so the
 * client never paints "Guest" while middleware already authenticated the user.
 */
async function getSupabaseSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const client = createSupabaseClientFromRequest(request);
  if (!client) {
    const userId = await getSupabaseUserIdFromRequest(request);
    if (!userId) return null;
    return profileForUserId(userId);
  }

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.id) return null;

  const fromJwt = sessionFromAuthUser(user);
  const profile = await profileForUserId(user.id);
  return mergeProfilePreferred(profile, fromJwt);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  const apiKeySession = await getBearerApiKeySession(request);
  if (apiKeySession) return apiKeySession;

  const supabaseSession = await getSupabaseSession(request);
  if (supabaseSession) return supabaseSession;

  // Dev cookie bypass — local only when AUTH_DEV_BYPASS=true
  if (env.authDevBypass) {
    return getCookieSession(request);
  }

  return null;
}

export function sessionCookieHeader(userId: string): string {
  const maxAge = 60 * 60 * 24 * 30;
  const secure = env.appUrl.startsWith("https") ? "; Secure" : "";
  return `${env.sessionCookieName}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
