import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { authEmailExists } from "@/backend/services/auth-email-otp.service";
import { assertEmailNotDisposable } from "@/backend/email-verifier/disposable-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check whether an email already has an account.
 * Used by the unified login → create-account flow.
 */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    throw new AppError("Enter a valid email address.", 400, "invalid_email");
  }
  assertEmailNotDisposable(email);
  const exists = await authEmailExists(email);
  return jsonData({
    email: email.toLowerCase(),
    exists,
    mode: exists ? ("login" as const) : ("create" as const),
  });
});
