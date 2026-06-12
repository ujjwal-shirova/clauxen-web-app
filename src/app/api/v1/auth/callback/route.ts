import { NextResponse } from "next/server"; // redirect response + Set-Cookie headers
import { AppError } from "@/backend/db/errors"; // structured error → jsonError mapping
import { sessionCookieHeader } from "@/backend/auth/session"; // signed session cookie value
import { env, isHydraConfigured } from "@/backend/config/env"; // appUrl + Hydra env flags
import {
  exchangeAuthorizationCode,
  fetchUserInfo,
} from "@/backend/ory/hydra-client"; // code → tokens; access_token → userinfo
import {
  clearOAuthCookiesHeader,
  readOAuthCookies,
} from "@/backend/ory/oauth-cookies"; // PKCE verifier + state cookies read/clear
import { syncFromHydraUserInfo } from "@/backend/services/identity.service"; // Hydra claims → local user row
import { jsonError } from "@/backend/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OAUTH_QUERY_PARAM_LEN = 512; // oversized query params reject — abuse/DoS mitigation

function oauthCallbackJsonError(error: unknown): NextResponse {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("Internal server error.", 500, "internal_error"); // unknown errors — no String(error) leak
  const response = jsonError(appError);
  for (const cookie of clearOAuthCookiesHeader()) {
    response.headers.append("Set-Cookie", cookie); // transient OAuth cookies clear on failure too
  }
  return response;
}

export async function GET(request: Request) {
  try {
    if (!isHydraConfigured()) {
      throw new AppError(
        "Hydra OIDC is not configured.",
        503,
        "hydra_unavailable",
      ); // env missing → service unavailable
    }

    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) {
      const code = /^[a-zA-Z0-9_-]{1,64}$/.test(error) ? error : "oauth_error";
      throw new AppError("OAuth authorization failed.", 400, code);
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (
      !code ||
      !state ||
      code.length > MAX_OAUTH_QUERY_PARAM_LEN ||
      state.length > MAX_OAUTH_QUERY_PARAM_LEN
    ) {
      throw new AppError(
        "Missing OAuth code or state.",
        400,
        "invalid_callback",
      ); // incomplete redirect
    }

    const { state: savedState, verifier } = readOAuthCookies(
      request.headers.get("cookie"),
    );
    if (!savedState || !verifier || savedState !== state) {
      throw new AppError("Invalid OAuth state.", 400, "invalid_state");
    }

    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: verifier,
    });
    const userInfo = await fetchUserInfo(tokens.access_token); // OIDC userinfo — sub, email, etc.
    const synced = await syncFromHydraUserInfo(userInfo);

    const redirectTo = new URL("/", env.appUrl);
    const response = NextResponse.redirect(redirectTo);
    response.headers.append("Set-Cookie", sessionCookieHeader(synced.userId)); // app session establish
    for (const cookie of clearOAuthCookiesHeader()) {
      response.headers.append("Set-Cookie", cookie);
    }

    return response;
  } catch (error) {
    return oauthCallbackJsonError(error);
  }
}
