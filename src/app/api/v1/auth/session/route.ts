import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData, jsonError } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { ensureUserRecord } from "@/server/services/identity.service";
import * as profileService from "@/server/services/profile.service";
import { getSupabaseClaimsFromRequest } from "@/server/auth/supabase-session";
import {
  sessionCookieHeader,
  clearSessionCookieHeader,
  type SessionUser,
} from "@/server/auth/session";
import { assertEmailNotDisposable } from "@/server/email-verifier/disposable-email";
import { resolveAuthAvatarUrl, resolveAuthFullName } from "@/lib/profile-names";
import {
  IDENTITY_HINT_COOKIE,
  identityHintCookieOptions,
  identityHintCookieValue,
  parseIdentityHintCookie,
} from "@/utils/identity-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionFromAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): SessionUser {
  const meta = user.user_metadata ?? null;
  const preferred =
    typeof meta?.preferred_name === "string"
      ? meta.preferred_name.trim() || null
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: resolveAuthFullName(meta) ?? user.email?.split("@")[0] ?? null,
    preferredName: preferred,
    avatarUrl: resolveAuthAvatarUrl(meta),
  };
}

/** Quiet boot: local JWT / hint only — no Auth round-trip or profile sync. */
async function resolveQuietSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const claims = await getSupabaseClaimsFromRequest(request);
  if (claims) {
    return sessionFromAuthUser({
      id: claims.sub,
      email: claims.email ?? null,
      user_metadata: claims.user_metadata ?? null,
    });
  }

  const hintRaw = request.cookies.get(IDENTITY_HINT_COOKIE)?.value;
  if (hintRaw) {
    const hint = parseIdentityHintCookie(hintRaw);
    if (hint?.id) {
      return {
        id: hint.id,
        email: hint.email,
        displayName: hint.displayName,
        preferredName: hint.preferredName,
        avatarUrl: hint.avatarUrl,
      };
    }
  }

  return null;
}

function attachSessionCookies(
  response: NextResponse,
  resolved: SessionUser | null,
) {
  if (resolved?.id) {
    response.headers.append("Set-Cookie", sessionCookieHeader(resolved.id));
    response.cookies.set(
      IDENTITY_HINT_COOKIE,
      identityHintCookieValue({
        id: resolved.id,
        email: resolved.email,
        displayName: resolved.displayName,
        preferredName: resolved.preferredName,
        avatarUrl: resolved.avatarUrl,
      }),
      identityHintCookieOptions(),
    );
  } else {
    response.headers.append("Set-Cookie", clearSessionCookieHeader());
    response.cookies.set(IDENTITY_HINT_COOKIE, "", {
      ...identityHintCookieOptions(0),
      maxAge: 0,
    });
  }
}

/**
 * Full session: verified JWT claims, provision once, return merged session.
 * No GoTrue round-trip; the browser client owns token refresh.
 */
const fullSessionHandler = withApiHandler(async ({ request, session }) => {
  // Verified JWT claims carry email + user_metadata — no GoTrue round-trip.
  const claims = await getSupabaseClaimsFromRequest(request);
  let resolved: SessionUser | null = session;

  if (claims) {
    const user = {
      id: claims.sub,
      email: claims.email ?? null,
      user_metadata: claims.user_metadata ?? {},
    };
    if (user.email) {
      // Disposable addresses are rejected; the client signs out on this code.
      assertEmailNotDisposable(user.email);
      const authFullName = resolveAuthFullName(user.user_metadata);
      await ensureUserRecord({
        userId: user.id,
        email: user.email,
        displayName: authFullName,
      });
    }
    resolved = await profileService.syncProfileFromAuth({
      userId: user.id,
      email: user.email ?? null,
      authMetadata: user.user_metadata,
    }).then((row) => {
      if (!row) return sessionFromAuthUser(user);
      return {
        id: row.id,
        email: row.email ?? user.email ?? null,
        displayName:
          row.display_name ??
          resolveAuthFullName(user.user_metadata) ??
          user.email?.split("@")[0] ??
          null,
        preferredName: row.preferred_name ?? null,
        avatarUrl:
          profileService.toClientAvatarUrl(row) ??
          resolveAuthAvatarUrl(user.user_metadata),
      } satisfies SessionUser;
    });
  } else if (session?.id && session.email) {
    assertEmailNotDisposable(session.email);
    await ensureUserRecord({
      userId: session.id,
      email: session.email,
      displayName: session.displayName,
    });
  }

  const response = jsonData({ session: resolved });
  attachSessionCookies(response, resolved);
  return response;
});

export async function GET(request: NextRequest) {
  // Boot path: skip withApiHandler's getUser() + profile sync for FCP.
  if (new URL(request.url).searchParams.get("quiet") === "1") {
    try {
      const resolved = await resolveQuietSession(request);
      const response = jsonData({ session: resolved });
      attachSessionCookies(response, resolved);
      return response;
    } catch (error) {
      return jsonError(
        error instanceof AppError ? error : new AppError(String(error), 500),
      );
    }
  }

  return fullSessionHandler(request);
}
