import type { NextRequest } from "next/server";
import { env } from "@/server/config/env";
import { queryOne } from "@/server/db/pool";
import { resolveUserIdFromApiKey } from "@/server/repositories/api-keys.repository";
import { getSupabaseClaimsFromRequest } from "@/server/auth/supabase-session";
import { resolveAuthAvatarUrl, resolveAuthFullName } from "@/lib/profile-names";
import { resolveClientAvatarUrl } from "@/lib/avatar-url";
import { resolveAccessTokenUser } from "@/server/oauth/service";
import { ACCESS_TOKEN_PREFIX } from "@/server/oauth/constants";

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
      avatar_file_id: string | null;
      avatar_storage_path: string | null;
      avatar_updated_at: string | null;
    }>(
      `select id, email, display_name, preferred_name, avatar_url,
              avatar_file_id, avatar_storage_path, avatar_updated_at
       from public.profiles where id = $1`,
      [userId],
    );

    if (!profile) return null;

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      preferredName: profile.preferred_name,
      avatarUrl: resolveClientAvatarUrl({
        userId: profile.id,
        avatarFileId: profile.avatar_file_id,
        avatarStoragePath: profile.avatar_storage_path,
        avatarUrl: profile.avatar_url,
        avatarUpdatedAt: profile.avatar_updated_at,
      }),
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

async function getBearerSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  // Clauxen Code OAuth access tokens
  if (token.startsWith(ACCESS_TOKEN_PREFIX) || token.startsWith("cla_at_")) {
    const oauth = await resolveAccessTokenUser(token);
    if (oauth) return profileForUserId(oauth.userId);
  }

  // User API keys (clx_…)
  const userId = await resolveUserIdFromApiKey(token);
  if (!userId) return null;

  return profileForUserId(userId);
}

async function getCookieSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const session = request.cookies.get(env.sessionCookieName)?.value?.trim();
  if (
    !session ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      session,
    )
  ) {
    return null;
  }
  const profile = await profileForUserId(session);
  if (profile) return profile;
  return {
    id: session,
    email: null,
    displayName: "Dev",
    preferredName: null,
    avatarUrl: null,
  };
}

const userActiveCache = new Map<string, { active: boolean; checkedAt: number }>();

export async function isUserActiveInDb(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = userActiveCache.get(userId);
  if (cached && now - cached.checkedAt < 15_000) {
    return cached.active;
  }
  try {
    const row = await queryOne<{ id: string }>(
      `select id from public.profiles where id = $1`,
      [userId],
    );
    const active = Boolean(row?.id);
    userActiveCache.set(userId, { active, checkedAt: now });
    return active;
  } catch {
    return true; // Fail open on transient pool blips
  }
}

export function invalidateUserActiveCache(userId?: string) {
  if (!userId) {
    userActiveCache.clear();
  } else {
    userActiveCache.delete(userId);
  }
}

/**
 * Identity from the verified Supabase JWT only — no GoTrue round-trip.
 * Verifies the user actually exists in the database so admin deletions take effect immediately.
 */
async function getSupabaseSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const claims = await getSupabaseClaimsFromRequest(request);
  if (!claims) return null;

  // Validate that user exists in database (prevents deleted users from persisting sessions)
  const active = await isUserActiveInDb(claims.sub);
  if (!active) return null;

  return sessionFromAuthUser({
    id: claims.sub,
    email: claims.email ?? null,
    user_metadata: claims.user_metadata ?? null,
  });
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  // Supabase JWT first: it is the browser's credential on every call and
  // verifies locally. API keys / OAuth tokens need a DB lookup.
  const supabaseSession = await getSupabaseSession(request);
  if (supabaseSession) return supabaseSession;

  const bearerSession = await getBearerSession(request);
  if (bearerSession) return bearerSession;

  // Dev cookie bypass — local only when AUTH_DEV_BYPASS=true
  if (env.authDevBypass) {
    return getCookieSession(request);
  }

  return null;
}

/** Session merged with the editable `profiles` row (names, avatar). */
export async function getSessionWithProfile(
  request: NextRequest,
): Promise<SessionUser | null> {
  const session = await getSessionFromRequest(request);
  if (!session) return null;
  const profile = await profileForUserId(session.id);
  return mergeProfilePreferred(profile, session);
}

export function sessionCookieHeader(userId: string): string {
  const maxAge = 60 * 60 * 24 * 30;
  const secure = env.appUrl.startsWith("https") ? "; Secure" : "";
  return `${env.sessionCookieName}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
