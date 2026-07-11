import type { NextRequest } from "next/server";
import { env } from "@/backend/config/env";
import { queryOne } from "@/backend/db/pool";
import { resolveUserIdFromApiKey } from "@/backend/repositories/api-keys.repository";
import { getSupabaseUserIdFromRequest } from "@/backend/auth/supabase-session";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
};

async function profileForUserId(userId: string): Promise<SessionUser | null> {
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

async function getSupabaseSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const userId = await getSupabaseUserIdFromRequest(request);
  if (!userId) return null;
  return profileForUserId(userId);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  const apiKeySession = await getBearerApiKeySession(request);
  if (apiKeySession) return apiKeySession;

  const supabaseSession = await getSupabaseSession(request);
  if (supabaseSession) return supabaseSession;

  // ponytail: dev cookie bypass — local only when AUTH_DEV_BYPASS=true
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
