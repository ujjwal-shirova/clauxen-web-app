import { NextResponse } from "next/server";
import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { ensureUserRecord } from "@/backend/services/identity.service";
import * as profileService from "@/backend/services/profile.service";
import { createSupabaseClientFromRequest } from "@/backend/auth/supabase-session";
import {
  getSessionFromRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from "@/backend/auth/session";
import {
  assertEmailNotDisposable,
  DISPOSABLE_EMAIL_CODE,
} from "@/backend/email-verifier/disposable-email";
import { resolveAuthFullName } from "@/lib/profile-names";
import {
  IDENTITY_HINT_COOKIE,
  identityHintCookieOptions,
  identityHintCookieValue,
} from "@/utils/identity-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request, session }) => {
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
      // Also covers X / Twitter OAuth users who may not share an email.
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

  return response;
});
