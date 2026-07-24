import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { requestSignupOtp } from "@/server/services/auth-email-otp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Send a 6-digit signup OTP via Cloudflare auth-email Worker. */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    throw new AppError("Email is required.", 400, "invalid_email");
  }
  const result = await requestSignupOtp(email);
  return jsonData(result);
});
