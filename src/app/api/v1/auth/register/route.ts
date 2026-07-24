import { withApiHandler } from "@/server/http/api-handler"; // session parse + centralized error wrapper
import { jsonData } from "@/server/http/api-response"; // { data } success JSON shape
import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";
import {
  findUserByEmail,
  logSecurityEvent,
  registerDevUser,
} from "@/server/services/identity.service"; // user create + audit log
import { sessionCookieHeader } from "@/server/auth/session"; // signed session cookie string builder
import { clientIp, clientUserAgent } from "@/server/http/request-meta"; // request metadata for security events
import { assertEmailNotDisposable } from "@/server/email-verifier/disposable-email";

const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_DISPLAY_NAME_LEN = 128;

function isReasonableEmail(email: string): boolean {
  return (
    email.length <= MAX_EMAIL_LEN && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request }) => {
  if (!env.authDevBypass) {
    throw new AppError(
      "Registration is disabled.",
      503,
      "auth_unavailable",
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
  }; // JSON body parse — optional email, password, displayName fields

  const email = body.email?.trim();
  if (!email) throw new AppError("Email is required.", 400); // empty email → 400 Bad Request
  if (!isReasonableEmail(email)) {
    throw new AppError("Invalid email address.", 400, "invalid_email");
  }
  assertEmailNotDisposable(email);

  const password = body.password ?? "";
  if (!password) throw new AppError("Password is required.", 400);
  if (password.length > MAX_PASSWORD_LEN) {
    throw new AppError("Password is too long.", 400, "invalid_password");
  }

  const displayName = body.displayName?.trim();
  if (displayName && displayName.length > MAX_DISPLAY_NAME_LEN) {
    throw new AppError(
      "Display name is too long.",
      400,
      "invalid_display_name",
    );
  }

  if (await findUserByEmail(email)) {
    throw new AppError(
      "An account with this email already exists.",
      409,
      "email_exists",
    );
  }

  const user = await registerDevUser({
    email,
    password,
    displayName,
  }); // identity service — profiles row insert + password hash (dev mode)

  await logSecurityEvent(user.userId, "register_success", {
    ip: clientIp(request),
    userAgent: clientUserAgent(request),
    metadata: { method: "dev_register" },
  });

  const response = jsonData({
    user: {
      id: user.userId,
      email: user.email,
      displayName: displayName ?? null,
    },
  });
  response.headers.set("Set-Cookie", sessionCookieHeader(user.userId));
  return response;
});
