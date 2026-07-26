import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  OauthError,
  exchangeAuthorizationCode,
  pollDeviceToken,
  refreshAccessToken,
} from "@/server/oauth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oauthErrorResponse(error: OauthError) {
  return NextResponse.json(
    { error: error.oauthError, error_description: error.message },
    { status: error.status },
  );
}

async function readBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const grantType = body.grant_type;
    const clientId = body.client_id;

    if (!grantType || !clientId) {
      throw new OauthError(
        "invalid_request",
        "grant_type and client_id are required.",
      );
    }

    if (grantType === "authorization_code") {
      if (!body.code || !body.redirect_uri || !body.code_verifier) {
        throw new OauthError(
          "invalid_request",
          "code, redirect_uri, and code_verifier are required.",
        );
      }
      const tokens = await exchangeAuthorizationCode({
        clientId,
        code: body.code,
        redirectUri: body.redirect_uri,
        codeVerifier: body.code_verifier,
      });
      return NextResponse.json(tokens);
    }

    if (grantType === "refresh_token") {
      if (!body.refresh_token) {
        throw new OauthError("invalid_request", "refresh_token is required.");
      }
      const tokens = await refreshAccessToken({
        clientId,
        refreshToken: body.refresh_token,
      });
      return NextResponse.json(tokens);
    }

    if (grantType === "urn:ietf:params:oauth:grant-type:device_code") {
      if (!body.device_code) {
        throw new OauthError("invalid_request", "device_code is required.");
      }
      const result = await pollDeviceToken({
        clientId,
        deviceCode: body.device_code,
      });
      if ("pending" in result && result.pending) {
        return NextResponse.json(
          {
            error: "authorization_pending",
            error_description: "User has not approved the device code yet.",
            interval: result.interval,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(result);
    }

    throw new OauthError("unsupported_grant_type", `Unsupported grant_type.`);
  } catch (error) {
    if (error instanceof OauthError) return oauthErrorResponse(error);
    console.error("[oauth/token]", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error." },
      { status: 500 },
    );
  }
}
