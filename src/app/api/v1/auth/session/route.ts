import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { ensureUserRecord } from "@/backend/services/identity.service";
import { createSupabaseClientFromRequest } from "@/backend/auth/supabase-session";
import {
  assertEmailNotDisposable,
  DISPOSABLE_EMAIL_CODE,
} from "@/backend/email-verifier/disposable-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request, session }) => {
  const supabase = createSupabaseClientFromRequest(request);
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id && user.email) {
      try {
        assertEmailNotDisposable(user.email);
      } catch (err) {
        if (err instanceof AppError && err.code === DISPOSABLE_EMAIL_CODE) {
          await supabase.auth.signOut();
          throw err;
        }
        throw err;
      }
      await ensureUserRecord({
        userId: user.id,
        email: user.email,
        displayName:
          (user.user_metadata?.display_name as string | undefined) ??
          (user.user_metadata?.full_name as string | undefined),
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
  return jsonData({ session });
});
