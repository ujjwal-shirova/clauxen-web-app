import type { NextRequest } from "next/server";
import { env, isOryConfigured } from "@/backend/config/env";
import { queryOne } from "@/backend/db/pool";
import { resolveUserIdFromApiKey } from "@/backend/repositories/api-keys.repository";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

async function getKratosSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader || !env.oryKratosPublicUrl) return null;

  const response = await fetch(`${env.oryKratosPublicUrl}/sessions/whoami`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const body = (await response.json()) as {
    identity?: {
      id?: string;
      traits?: { email?: string; name?: { first?: string; last?: string } };
    };
  };

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

async function profileForUserId(userId: string): Promise<SessionUser | null> {
  const profile = await queryOne<{
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>(
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

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  const apiKeySession = await getBearerApiKeySession(request);
  if (apiKeySession) return apiKeySession;

  if (isOryConfigured()) {
    const orySession = await getKratosSession(request);
    if (orySession) return orySession;
  }

  return getCookieSession(request);
}

export function sessionCookieHeader(userId: string): string {
  const maxAge = 60 * 60 * 24 * 30;
  const secure = env.appUrl.startsWith("https") ? "; Secure" : "";
  return `${env.sessionCookieName}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${env.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
