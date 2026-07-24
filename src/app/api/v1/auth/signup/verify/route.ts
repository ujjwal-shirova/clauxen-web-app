import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import {
  createAccountAfterOtp,
  verifySignupOtp,
} from "@/server/services/auth-email-otp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify OTP → consume ticket → create confirmed Supabase user.
 * Client then signs in with email/password.
 */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    password?: string;
  };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !code || !password) {
    throw new AppError(
      "Email, verification code, and password are required.",
      400,
      "invalid_request",
    );
  }

  const { signupTicket } = await verifySignupOtp({ email, code });
  const created = await createAccountAfterOtp({
    email,
    password,
    signupTicket,
  });

  return jsonData({
    ok: true as const,
    email: created.email,
    userId: created.userId,
  });
});
