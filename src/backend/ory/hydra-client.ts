// authorize URL build, token exchange, userinfo, admin introspection — server-side only
// =============================================================================

import { createHash, randomBytes } from "crypto";
import { env } from "@/backend/config/env"; // Ory Hydra URLs, client_id, client_secret, redirect URI config
import { AppError } from "@/backend/db/errors"; // typed HTTP errors — 502/503 with machine-readable codes

// Hydra /oauth2/token endpoint response shape — access_token, refresh, expiry
export type HydraTokenResponse = {
  access_token: string;
  refresh_token?: string; // offline_access scope — long-lived session refresh
  expires_in: number; // seconds until access_token expiry
  token_type: string; // typically "bearer"
  scope?: string; // granted scopes string
  id_token?: string; // OIDC identity JWT — profile claims embedded
};

export type HydraUserInfo = {
  sub: string; // subject — unique user identifier (Hydra/Kratos identity id)
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
};

function hydraPublicUrl(): string {
  if (!env.oryHydraPublicUrl) {
    throw new AppError("Hydra is not configured.", 503, "hydra_unavailable");
  }
  return env.oryHydraPublicUrl.replace(/\/$/, ""); // normalize — double-slash URL bugs avoid
}

function hydraAdminUrl(): string {
  if (!env.oryHydraAdminUrl) {
    throw new AppError(
      "Hydra admin is not configured.",
      503,
      "hydra_unavailable",
    );
  }
  return env.oryHydraAdminUrl.replace(/\/$/, "");
}

// OAuth redirect_uri — env override should default appUrl + /api/v1/auth/callback
export function hydraRedirectUri(): string {
  return (
    env.oryHydraRedirectUri ||
    `${env.appUrl.replace(/\/$/, "")}/api/v1/auth/callback`
  );
}

// CSRF protection state parameter — 24 random bytes base64url encoded
export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

// PKCE pair generate — public client flow without client_secret on wire
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// browser redirect URL build — authorization code flow start
export function buildAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: env.oryHydraClientId, // registered Hydra OAuth client
    response_type: "code", // authorization code flow (not implicit)
    scope: "openid offline_access profile email", // OIDC + refresh token + profile claims
    redirect_uri: hydraRedirectUri(), // must match Hydra client registration exactly
    state: input.state, // CSRF token — callback validation
    code_challenge: input.codeChallenge, // PKCE public challenge
    code_challenge_method: "S256", // SHA-256 method per RFC 7636
  });

  return `${hydraPublicUrl()}/oauth2/auth?${params.toString()}`;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<HydraTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code", // standard OAuth2 grant
    code: input.code,
    redirect_uri: hydraRedirectUri(),
    client_id: env.oryHydraClientId,
    code_verifier: input.codeVerifier,
  });

  if (env.oryHydraClientSecret) {
    body.set("client_secret", env.oryHydraClientSecret);
  }

  const response = await fetch(`${hydraPublicUrl()}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AppError(
      "Hydra token exchange failed.",
      502,
      "hydra_token_error",
    );
  }

  return (await response.json()) as HydraTokenResponse;
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<HydraUserInfo> {
  const response = await fetch(`${hydraPublicUrl()}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AppError(
      "Failed to load OIDC user info.",
      502,
      "hydra_userinfo_error",
    );
  }

  return (await response.json()) as HydraUserInfo; // email, sub, name — identity sync input
}

// RFC 7662 token introspection — admin API; token active/expired/scopes check
export async function introspectToken(
  token: string,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ token }); // introspect POST body — token string only
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (env.oryHydraClientSecret) {
    // admin introspect — Basic auth client_id:secret (Hydra admin requirement)
    const basic = Buffer.from(
      `${env.oryHydraClientId}:${env.oryHydraClientSecret}`,
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  const response = await fetch(`${hydraAdminUrl()}/admin/oauth2/introspect`, {
    method: "POST",
    headers,
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AppError(
      "Hydra token introspection failed.",
      502,
      "hydra_introspect_error",
    );
  }

  return (await response.json()) as Record<string, unknown>; // active, sub, exp, scope — validation logic upstream
}
