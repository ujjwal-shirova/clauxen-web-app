import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData, jsonError } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { ensureUserRecord } from "@/backend/services/identity.service";
import * as profileService from "@/backend/services/profile.service";
import { createSupabaseClientFromRequest } from "@/backend/auth/supabase-session";
import {
  getSessionFromRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
  type SessionUser,
} from "@/backend/auth/session";
import {
  assertEmailNotDisposable,
  DISPOSABLE_EMAIL_CODE,
} from "@/backend/email-verifier/disposable-email";
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
  const supabase = createSupabaseClientFromRequest(request);
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return sessionFromAuthUser(session.user);
    }
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

const fullSessionHandler = withApiHandler(async ({ request, session }) => {
  const supabase = createSupabaseClientFromRequest(request);
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      if (user.email) {
        try {
          assertEmailNotDisposable(user.email);
        } catch (err) {
          if (err instanceof AppError && err.code === DISPOSABLE_EMAIL_CODE) {
            await supabase.auth.signOut();
            throw err;
          }
          throw err;
        }
        const authFullName = resolveAuthFullName(user.user_metadata);
        await ensureUserRecord({
          userId: user.id,
          email: user.email,
          displayName: authFullName,
        });
      }
      await profileService.syncProfileFromAuth({
        userId: user.id,
        email: user.email ?? null,
        authMetadata: user.user_metadata,
      });
    }
  }

  if (session?.id && session.email) {
    assertEmailNotDisposable(session.email);
    await ensureUserRecord({
      userId: session.id,
      email: session.email,
      displayName: session.displayName,
    });
  }

  const freshSession = await getSessionFromRequest(request);
  const resolved = freshSession ?? session;
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
