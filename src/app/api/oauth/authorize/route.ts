import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/server/auth/session";
import {
  OauthError,
  createAuthorizationCode,
} from "@/server/oauth/service";
import { CLAUXEN_CODE_CLIENT_ID } from "@/server/oauth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: "login_required", error_description: "Sign in required." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const clientId =
      typeof body.client_id === "string"
        ? body.client_id
        : CLAUXEN_CODE_CLIENT_ID;
    const redirectUri =
      typeof body.redirect_uri === "string" ? body.redirect_uri : "";
    const state = typeof body.state === "string" ? body.state : null;
    const codeChallenge =
      typeof body.code_challenge === "string" ? body.code_challenge : "";
    const codeChallengeMethod =
      typeof body.code_challenge_method === "string"
        ? body.code_challenge_method
        : "S256";
    const scope = typeof body.scope === "string" ? body.scope : null;
    const action = typeof body.action === "string" ? body.action : "approve";

    if (action === "deny") {
      if (!redirectUri) {
        return NextResponse.json(
          { error: "invalid_request", error_description: "redirect_uri required." },
          { status: 400 },
        );
      }
      const url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set(
        "error_description",
        "The user denied the authorization request.",
      );
      if (state) url.searchParams.set("state", state);
      return NextResponse.json({ redirect_to: url.toString() });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");

    const result = await createAuthorizationCode({
      clientId,
      redirectUri,
      responseType: "code",
      state,
      codeChallenge,
      codeChallengeMethod,
      scope,
      userId: session.id,
      ipAddress: ip,
      userAgent,
    });

    const url = new URL(result.redirectUri);
    url.searchParams.set("code", result.code);
    if (result.state) url.searchParams.set("state", result.state);

    return NextResponse.json({ redirect_to: url.toString() });
  } catch (error) {
    if (error instanceof OauthError) {
      return NextResponse.json(
        { error: error.oauthError, error_description: error.message },
        { status: error.status },
      );
    }
    console.error("[oauth/authorize]", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error." },
      { status: 500 },
    );
  }
}
