import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { completeMagicSignup } from "@/server/services/auth-email-otp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consume magic link → create confirmed Supabase user.
 * Client then signs in with email/password and lands on onboarding.
 */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    throw new AppError(
      "Magic link token and password are required.",
      400,
      "invalid_request",
    );
  }

  const created = await completeMagicSignup({ token, password });
  return jsonData({
    ok: true as const,
    email: created.email,
    userId: created.userId,
  });
});
