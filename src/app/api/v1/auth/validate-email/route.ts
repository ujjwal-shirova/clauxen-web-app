import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { AppError } from "@/backend/db/errors";
import {
  assertEmailNotDisposable,
  DISPOSABLE_EMAIL_CODE,
  DISPOSABLE_EMAIL_MESSAGE,
} from "@/backend/email-verifier/disposable-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EMAIL_LEN = 320;

/**
 * Server-side disposable-domain gate. Call before any email auth attempt.
 * Client UI checks are convenience only — this is the enforcement point.
 */
export const POST = withApiHandler(async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    throw new AppError("Email is required.", 400, "invalid_email");
  }
  if (email.length > MAX_EMAIL_LEN) {
    throw new AppError("Email is too long.", 400, "invalid_email");
  }
  if (!email.includes("@")) {
    throw new AppError("Invalid email address.", 400, "invalid_email");
  }

  assertEmailNotDisposable(email);

  return jsonData({
    ok: true as const,
    code: "allowed" as const,
  });
});

// Re-export for clients that map by code (documentation only).
export const DISPOSABLE = {
  code: DISPOSABLE_EMAIL_CODE,
  message: DISPOSABLE_EMAIL_MESSAGE,
};
