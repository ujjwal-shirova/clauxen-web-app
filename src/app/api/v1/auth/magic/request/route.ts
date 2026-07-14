import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { requestMagicSignupLink } from "@/backend/services/auth-email-otp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Email a 5-minute magic signup link (new users). */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    throw new AppError("Email is required.", 400, "invalid_email");
  }
  const result = await requestMagicSignupLink(email);
  return jsonData(result);
});
