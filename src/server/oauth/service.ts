import { createHash } from "crypto";
import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_PREFIX,
  AUTH_CODE_TTL_SECONDS,
  CLAUXEN_CODE_CLIENT_ID,
  CLAUXEN_CODE_SCOPES,
  DEVICE_CODE_PREFIX,
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/server/oauth/constants";
import {
  generateOpaqueToken,
  generateUserCode,
  hashToken,
  verifyPkceS256,
} from "@/server/oauth/crypto";
import { isAllowedLoopbackRedirect, normalizeRedirectUri } from "@/server/oauth/redirect";
import * as repo from "@/server/oauth/repository";

export class OauthError extends AppError {
  readonly oauthError: string;

  constructor(
    oauthError: string,
    message: string,
    status = 400,
    code = "oauth_error",
  ) {
    super(message, status, code);
    this.oauthError = oauthError;
  }
}

function parseScopes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [...CLAUXEN_CODE_SCOPES];
  const requested = raw
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<string>(CLAUXEN_CODE_SCOPES);
  const invalid = requested.filter((s) => !allowed.has(s));
  if (invalid.length > 0) {
    throw new OauthError(
      "invalid_scope",
      `Unsupported scope(s): ${invalid.join(", ")}`,
    );
  }
  // Always include openid + code:inference for CLI usefulness
  const set = new Set(requested);
  set.add("openid");
  set.add("code:inference");
  return Array.from(set);
}

async function requireActiveClient(clientId: string) {
  const client = await repo.getOauthClientByClientId(clientId);
  if (!client || client.status !== "active") {
    throw new OauthError("invalid_client", "Unknown or inactive OAuth client.", 401);
  }
  return client;
}

export function validateRedirectUri(redirectUri: string): string {
  const normalized = normalizeRedirectUri(redirectUri);
  if (!isAllowedLoopbackRedirect(normalized)) {
    throw new OauthError(
      "invalid_request",
      "redirect_uri must be an http loopback callback (127.0.0.1 or [::1]).",
    );
  }
  return normalized;
}

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string | null;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuthorizationCode(
  params: AuthorizeParams,
): Promise<{ code: string; redirectUri: string; state: string | null }> {
  if (params.responseType !== "code") {
    throw new OauthError("unsupported_response_type", "Only response_type=code is supported.");
  }
  if (params.codeChallengeMethod !== "S256") {
    throw new OauthError("invalid_request", "code_challenge_method must be S256.");
  }
  if (!params.codeChallenge || params.codeChallenge.length < 43) {
    throw new OauthError("invalid_request", "code_challenge is required (S256).");
  }

  const client = await requireActiveClient(params.clientId);
  if (client.client_id !== CLAUXEN_CODE_CLIENT_ID) {
    throw new OauthError("unauthorized_client", "Client is not authorized for CLI login.");
  }

  const redirectUri = validateRedirectUri(params.redirectUri);
  const scopes = parseScopes(params.scope);
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000);
  const stateHash = params.state
    ? createHash("sha256").update(params.state).digest("hex")
    : null;

  const request = await repo.insertAuthorizationRequest({
    userId: params.userId,
    oauthClientId: client.id,
    redirectUri,
    scopes,
    stateHash,
    codeChallenge: params.codeChallenge,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    expiresAt,
  });

  const code = generateOpaqueToken(AUTH_CODE_PREFIX);
  await repo.insertAuthorizationCode({
    authorizationRequestId: request.id,
    userId: params.userId,
    oauthClientId: client.id,
    codeHash: hashToken(code),
    redirectUri,
    scopes,
    codeChallenge: params.codeChallenge,
    expiresAt,
  });

  await repo.upsertConsentGrant({
    userId: params.userId,
    oauthClientId: client.id,
    scopes,
  });

  await repo.insertOauthEvent({
    userId: params.userId,
    oauthClientId: client.id,
    eventType: "authorization_code_issued",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { code, redirectUri, state: params.state };
}

export type TokenSuccess = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

async function issueTokenPair(input: {
  userId: string;
  oauthClientId: string;
  scopes: string[];
  familyId?: string;
  rotatedFromTokenId?: string | null;
}): Promise<TokenSuccess> {
  const familyId =
    input.familyId ??
    (await repo.createRefreshFamily({
      userId: input.userId,
      oauthClientId: input.oauthClientId,
    })).id;

  const refreshRaw = generateOpaqueToken(REFRESH_TOKEN_PREFIX);
  const refresh = await repo.insertRefreshToken({
    familyId,
    userId: input.userId,
    oauthClientId: input.oauthClientId,
    tokenHash: hashToken(refreshRaw),
    scopes: input.scopes,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    rotatedFromTokenId: input.rotatedFromTokenId ?? null,
  });

  const accessRaw = generateOpaqueToken(ACCESS_TOKEN_PREFIX);
  await repo.insertAccessToken({
    refreshTokenId: refresh.id,
    userId: input.userId,
    oauthClientId: input.oauthClientId,
    tokenHash: hashToken(accessRaw),
    scopes: input.scopes,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
  });

  return {
    access_token: accessRaw,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshRaw,
    scope: input.scopes.join(" "),
  };
}

export async function exchangeAuthorizationCode(input: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenSuccess> {
  const client = await requireActiveClient(input.clientId);
  if (!client.allowed_grant_types.includes("authorization_code")) {
    throw new OauthError("unauthorized_client", "authorization_code grant not allowed.");
  }

  const redirectUri = validateRedirectUri(input.redirectUri);
  const codeRow = await repo.findAuthorizationCodeByHash(hashToken(input.code));
  if (!codeRow || codeRow.oauth_client_id !== client.id) {
    throw new OauthError("invalid_grant", "Invalid authorization code.");
  }
  if (codeRow.status !== "active" || codeRow.consumed_at) {
    throw new OauthError("invalid_grant", "Authorization code already used.");
  }
  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    throw new OauthError("invalid_grant", "Authorization code expired.");
  }
  if (codeRow.redirect_uri !== redirectUri) {
    throw new OauthError("invalid_grant", "redirect_uri mismatch.");
  }
  if (!verifyPkceS256(input.codeVerifier, codeRow.code_challenge)) {
    throw new OauthError("invalid_grant", "PKCE verification failed.");
  }

  const consumed = await repo.consumeAuthorizationCode(codeRow.id);
  if (!consumed) {
    throw new OauthError("invalid_grant", "Authorization code already used.");
  }

  const tokens = await issueTokenPair({
    userId: codeRow.user_id,
    oauthClientId: client.id,
    scopes: codeRow.scopes,
  });

  await repo.insertOauthEvent({
    userId: codeRow.user_id,
    oauthClientId: client.id,
    eventType: "token_issued",
    metadata: { grant: "authorization_code" },
  });

  return tokens;
}

export async function refreshAccessToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenSuccess> {
  const client = await requireActiveClient(input.clientId);
  if (!client.allowed_grant_types.includes("refresh_token")) {
    throw new OauthError("unauthorized_client", "refresh_token grant not allowed.");
  }

  const existing = await repo.findRefreshTokenByHash(hashToken(input.refreshToken));
  if (!existing || existing.oauth_client_id !== client.id) {
    throw new OauthError("invalid_grant", "Invalid refresh token.");
  }
  if (existing.status !== "active" || existing.revoked_at) {
    // Possible reuse — revoke family
    await repo.revokeRefreshFamily(existing.family_id);
    throw new OauthError("invalid_grant", "Refresh token revoked.");
  }
  if (new Date(existing.expires_at).getTime() < Date.now()) {
    throw new OauthError("invalid_grant", "Refresh token expired.");
  }

  await repo.revokeRefreshToken(existing.id);

  const tokens = await issueTokenPair({
    userId: existing.user_id,
    oauthClientId: client.id,
    scopes: existing.scopes,
    familyId: existing.family_id,
    rotatedFromTokenId: existing.id,
  });

  await repo.insertOauthEvent({
    userId: existing.user_id,
    oauthClientId: client.id,
    eventType: "token_refreshed",
  });

  return tokens;
}

export async function startDeviceAuthorization(input: {
  clientId: string;
  scope?: string | null;
}): Promise<{
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}> {
  const client = await requireActiveClient(input.clientId);
  if (
    !client.allowed_grant_types.includes(
      "urn:ietf:params:oauth:grant-type:device_code",
    )
  ) {
    throw new OauthError("unauthorized_client", "Device code grant not allowed.");
  }

  const scopes = parseScopes(input.scope ?? null);
  const deviceCode = generateOpaqueToken(DEVICE_CODE_PREFIX);
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

  await repo.insertDeviceCode({
    oauthClientId: client.id,
    deviceCodeHash: hashToken(deviceCode),
    userCodeHash: hashToken(userCode.toUpperCase()),
    scopes,
    expiresAt,
    intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
    metadata: { user_code_display: userCode },
  });

  const base = env.appUrl.replace(/\/+$/, "");
  const verificationUri = `${base}/cli/device`;
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
    expires_in: DEVICE_CODE_TTL_SECONDS,
    interval: DEVICE_POLL_INTERVAL_SECONDS,
  };
}

export async function approveDeviceUserCode(input: {
  userCode: string;
  userId: string;
}): Promise<void> {
  const normalized = input.userCode.trim().toUpperCase().replace(/\s+/g, "");
  const row = await repo.findDeviceByUserCodeHash(hashToken(normalized));
  if (!row) {
    throw new AppError("Invalid device code.", 404, "invalid_user_code");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError("Device code expired.", 410, "expired_token");
  }
  if (row.approved_at || row.consumed_at) {
    throw new AppError("Device code already used.", 409, "already_approved");
  }

  const ok = await repo.approveDeviceCode(row.id, input.userId);
  if (!ok) {
    throw new AppError("Unable to approve device code.", 409, "approve_failed");
  }

  await repo.upsertConsentGrant({
    userId: input.userId,
    oauthClientId: row.oauth_client_id,
    scopes: row.scopes,
  });

  await repo.insertOauthEvent({
    userId: input.userId,
    oauthClientId: row.oauth_client_id,
    eventType: "device_approved",
  });
}

export async function pollDeviceToken(input: {
  clientId: string;
  deviceCode: string;
}): Promise<TokenSuccess | { pending: true; interval: number }> {
  const client = await requireActiveClient(input.clientId);
  const row = await repo.findDeviceByDeviceCodeHash(hashToken(input.deviceCode));
  if (!row || row.oauth_client_id !== client.id) {
    throw new OauthError("invalid_grant", "Invalid device code.");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new OauthError("expired_token", "Device code expired.", 400);
  }
  if (row.consumed_at) {
    throw new OauthError("invalid_grant", "Device code already used.");
  }
  if (!row.approved_at || !row.user_id) {
    return { pending: true, interval: row.interval_seconds };
  }

  const consumed = await repo.consumeDeviceCode(row.id);
  if (!consumed) {
    throw new OauthError("invalid_grant", "Device code already used.");
  }

  const tokens = await issueTokenPair({
    userId: row.user_id,
    oauthClientId: client.id,
    scopes: row.scopes,
  });

  await repo.insertOauthEvent({
    userId: row.user_id,
    oauthClientId: client.id,
    eventType: "token_issued",
    metadata: { grant: "device_code" },
  });

  return tokens;
}

export async function resolveAccessTokenUser(
  rawToken: string,
): Promise<{ userId: string; scopes: string[] } | null> {
  if (!rawToken.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const row = await repo.findAccessTokenByHash(hashToken(rawToken));
  if (!row) return null;
  if (row.status !== "active" || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  void repo.touchAccessToken(row.id);
  return { userId: row.user_id, scopes: row.scopes };
}

export async function revokeToken(rawToken: string): Promise<void> {
  if (rawToken.startsWith(ACCESS_TOKEN_PREFIX)) {
    await repo.revokeAccessTokenByHash(hashToken(rawToken));
    return;
  }
  if (rawToken.startsWith(REFRESH_TOKEN_PREFIX)) {
    await repo.revokeRefreshTokenByHash(hashToken(rawToken));
    return;
  }
  // Try both hashes for opaque tokens without recognizable prefix
  const h = hashToken(rawToken);
  const at = await repo.revokeAccessTokenByHash(h);
  if (!at) await repo.revokeRefreshTokenByHash(h);
}

export async function getClientPublicInfo(clientId: string) {
  const client = await requireActiveClient(clientId);
  return {
    clientId: client.client_id,
    name: client.name,
    description: client.description,
  };
}
