import { NextResponse } from "next/server"; // GET redirect response
import { withApiHandler } from "@/backend/http/api-handler"; // POST handler wrapper
import { jsonData } from "@/backend/http/api-response"; // POST success JSON
import { AppError } from "@/backend/db/errors";
import { env, isHydraConfigured } from "@/backend/config/env"; // authDevBypass + Hydra URLs
import {
  findUserByEmail,
  logSecurityEvent,
  registerDevUser,
  verifyDevPassword,
} from "@/backend/services/identity.service"; // dev identity + audit log
import { clientIp, clientUserAgent } from "@/backend/http/request-meta"; // security event metadata
import { sessionCookieHeader } from "@/backend/auth/session";
import {
  buildAuthorizeUrl,
  createOAuthState,
  createPkcePair,
} from "@/backend/ory/hydra-client"; // OIDC authorize URL + PKCE
import { oauthStateCookieHeader } from "@/backend/ory/oauth-cookies"; // state + verifier cookies

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
  if (!isHydraConfigured()) {
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
          message: "OIDC login is not configured.",
          code: "auth_unavailable",
        },
      },
      { status: 503 },
    );
  }

  const state = createOAuthState(); // random CSRF state string
  const pkce = createPkcePair(); // S256 challenge + verifier pair
  const authorizeUrl = buildAuthorizeUrl({
    state,
    codeChallenge: pkce.challenge,
  }); // Hydra /oauth2/auth URL

  const response = NextResponse.redirect(authorizeUrl);
  for (const cookie of oauthStateCookieHeader(state, pkce.verifier)) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export const POST = withApiHandler(async ({ request }) => {
  if (!env.authDevBypass && !isHydraConfigured()) {
    throw new AppError(
      "Authentication is not configured.",
      503,
      "auth_unavailable",
    ); // dev bypass off + no Hydra
  }

  if (!env.authDevBypass && isHydraConfigured()) {
    throw new AppError(
      "Password login is disabled. Use GET /api/v1/auth/login for Ory OIDC.",
      400,
      "use_oidc",
    );
  }

  const body = (await request.json()) as { email?: string; password?: string }; // dev login credentials
  const email = body.email?.trim(); // whitespace trim
  const password = body.password ?? "";
  const ip = clientIp(request);

  if (!email) {
    throw new AppError("Email is required.", 400); // email mandatory
  }

  let user = await findUserByEmail(email); // existing dev user lookup
  let isNewUser = false;
  if (!user) {
    const created = await registerDevUser({ email, password }); // auto-register dev user
    user = {
      id: created.userId,
      email: created.email,
      display_name: email.split("@")[0],
    }; // local shape normalize
    isNewUser = true;
  } else {
    const ok = await verifyDevPassword(user.id, password); // bcrypt verify existing user
    if (!ok) {
      await logSecurityEvent(user.id, "login_failed", {
        ip,
        userAgent: clientUserAgent(request),
        metadata: { method: "dev_password", reason: "invalid_credentials" },
      });
      throw new AppError("Invalid credentials.", 401, "invalid_credentials"); // wrong password
    }
  }

  await logSecurityEvent(
    user.id,
    isNewUser ? "register_success" : "login_success",
    {
      ip, // audit — client IP
      userAgent: clientUserAgent(request), // audit — browser UA
      metadata: { method: "dev_password" }, // dev flow identifier
    },
  );

  const response = jsonData({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
  });

  response.headers.set("Set-Cookie", sessionCookieHeader(user.id)); // HttpOnly session cookie set
  return response;
});
