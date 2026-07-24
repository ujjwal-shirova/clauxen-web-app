import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";
import {
  findUserByEmail,
  logSecurityEvent,
  registerDevUser,
  verifyDevPassword,
} from "@/server/services/identity.service";
import { clientIp, clientUserAgent } from "@/server/http/request-meta";
import { sessionCookieHeader } from "@/server/auth/session";
import { assertEmailNotDisposable } from "@/server/email-verifier/disposable-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGIN_EMAIL_LEN = 320;
const MAX_LOGIN_PASSWORD_LEN = 128;
const LOGIN_RATE_WINDOW_MS = 60_000;
const LOGIN_RATE_MAX_ATTEMPTS = 20;

const loginAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

function assertLoginRateLimit(ip: string) {
  const now = Date.now();
  const entry = loginAttemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttemptsByIp.set(ip, {
      count: 1,
      resetAt: now + LOGIN_RATE_WINDOW_MS,
    });
    return;
  }
  entry.count += 1;
  if (entry.count > LOGIN_RATE_MAX_ATTEMPTS) {
    throw new AppError(
      "Too many login attempts. Try again later.",
      429,
      "rate_limited",
    );
  }
}

export async function GET() {
  if (env.authDevBypass) {
    return NextResponse.json({
      data: {
        mode: "dev",
        message: "Use POST /api/v1/auth/login for dev cookie auth.",
      },
    });
  }
  return NextResponse.json(
    {
      error: {
        message: "Login is not configured.",
        code: "auth_unavailable",
      },
    },
    { status: 503 },
  );
}

export const POST = withApiHandler(async ({ request }) => {
  if (!env.authDevBypass) {
    throw new AppError(
      "Dev password auth is disabled.",
      503,
      "auth_unavailable",
    );
  }

  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password ?? "";
  const ip = clientIp(request);
  assertLoginRateLimit(ip ?? "unknown");

  if (!email) {
    throw new AppError("Email is required.", 400);
  }
  assertEmailNotDisposable(email);

  let user = await findUserByEmail(email);
  let isNewUser = false;
  if (!user) {
    const created = await registerDevUser({ email, password });
    user = {
      id: created.userId,
      email: created.email,
      display_name: email.split("@")[0],
    };
    isNewUser = true;
  } else {
    const ok = await verifyDevPassword(user.id, password);
    if (!ok) {
      await logSecurityEvent(user.id, "login_failed", {
        ip,
        userAgent: clientUserAgent(request),
        metadata: { method: "dev_password", reason: "invalid_credentials" },
      });
      throw new AppError("Invalid credentials.", 401, "invalid_credentials");
    }
  }

  await logSecurityEvent(
    user.id,
    isNewUser ? "register_success" : "login_success",
    {
      ip,
      userAgent: clientUserAgent(request),
      metadata: { method: "dev_password" },
    },
  );

  const response = jsonData({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
  });

  response.headers.set("Set-Cookie", sessionCookieHeader(user.id));
  return response;
});
