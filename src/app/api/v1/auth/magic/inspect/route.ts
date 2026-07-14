import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import { inspectMagicLink } from "@/backend/services/auth-email-otp.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Peek a magic link token without burning it. */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    throw new AppError("Magic link token is required.", 400, "invalid_token");
  }
  const result = await inspectMagicLink(token);
  return jsonData({
    ok: true as const,
    email: result.email,
    purpose: result.purpose,
    expiresInSeconds: result.expiresInSeconds,
  });
});
