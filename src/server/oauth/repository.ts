import { query, queryOne } from "@/server/db/pool";

export type OauthClientRow = {
  id: string;
  client_id: string;
  client_type: string;
  status: string;
  name: string;
  description: string | null;
  require_pkce: boolean;
  first_party: boolean;
  allowed_grant_types: string[];
  metadata: Record<string, unknown>;
};

export async function getOauthClientByClientId(
  clientId: string,
): Promise<OauthClientRow | null> {
  return queryOne<OauthClientRow>(
    `select id, client_id, client_type, status, name, description,
            require_pkce, first_party, allowed_grant_types, metadata
     from public.oauth_clients
     where client_id = $1 and deleted_at is null`,
    [clientId],
  );
}

export async function insertAuthorizationRequest(input: {
  userId: string | null;
  oauthClientId: string;
  redirectUri: string;
  scopes: string[];
  stateHash: string | null;
  codeChallenge: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_authorization_requests (
       user_id, oauth_client_id, redirect_uri, scopes, state_hash,
       code_challenge, code_challenge_method, ip_address, user_agent, expires_at
     ) values ($1,$2,$3,$4,$5,$6,'S256',$7,$8,$9)
     returning id`,
    [
      input.userId,
      input.oauthClientId,
      input.redirectUri,
      input.scopes,
      input.stateHash,
      input.codeChallenge,
      input.ipAddress,
      input.userAgent,
      input.expiresAt.toISOString(),
    ],
  );
  if (!row) throw new Error("Failed to create authorization request");
  return row;
}

export async function insertAuthorizationCode(input: {
  authorizationRequestId: string;
  userId: string;
  oauthClientId: string;
  codeHash: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  expiresAt: Date;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_authorization_codes (
       authorization_request_id, user_id, oauth_client_id, code_hash,
       redirect_uri, scopes, code_challenge, code_challenge_method, expires_at
     ) values ($1,$2,$3,$4,$5,$6,$7,'S256',$8)
     returning id`,
    [
      input.authorizationRequestId,
      input.userId,
      input.oauthClientId,
      input.codeHash,
      input.redirectUri,
      input.scopes,
      input.codeChallenge,
      input.expiresAt.toISOString(),
    ],
  );
  if (!row) throw new Error("Failed to create authorization code");
  return row;
}

export type AuthCodeRow = {
  id: string;
  user_id: string;
  oauth_client_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string;
  status: string;
  expires_at: string;
  consumed_at: string | null;
};

export async function findAuthorizationCodeByHash(
  codeHash: string,
): Promise<AuthCodeRow | null> {
  return queryOne<AuthCodeRow>(
    `select id, user_id, oauth_client_id, redirect_uri, scopes, code_challenge,
            status, expires_at, consumed_at
     from public.oauth_authorization_codes
     where code_hash = $1`,
    [codeHash],
  );
}

export async function consumeAuthorizationCode(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `update public.oauth_authorization_codes
     set status = 'revoked', consumed_at = now()
     where id = $1 and status = 'active' and consumed_at is null
       and expires_at > now()
     returning id`,
    [id],
  );
  return Boolean(row);
}

export async function upsertConsentGrant(input: {
  userId: string;
  oauthClientId: string;
  scopes: string[];
}): Promise<void> {
  await query(
    `insert into public.oauth_consent_grants (user_id, oauth_client_id, scopes)
     values ($1, $2, $3)
     on conflict (user_id, oauth_client_id) do update
     set scopes = excluded.scopes,
         granted_at = now(),
         revoked_at = null`,
    [input.userId, input.oauthClientId, input.scopes],
  );
}

export async function createRefreshFamily(input: {
  userId: string;
  oauthClientId: string;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_refresh_token_families (user_id, oauth_client_id)
     values ($1, $2)
     returning id`,
    [input.userId, input.oauthClientId],
  );
  if (!row) throw new Error("Failed to create refresh family");
  return row;
}

export async function insertRefreshToken(input: {
  familyId: string;
  userId: string;
  oauthClientId: string;
  tokenHash: string;
  scopes: string[];
  expiresAt: Date;
  rotatedFromTokenId?: string | null;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_refresh_tokens (
       family_id, user_id, oauth_client_id, token_hash, scopes, expires_at, rotated_from_token_id
     ) values ($1,$2,$3,$4,$5,$6,$7)
     returning id`,
    [
      input.familyId,
      input.userId,
      input.oauthClientId,
      input.tokenHash,
      input.scopes,
      input.expiresAt.toISOString(),
      input.rotatedFromTokenId ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create refresh token");
  return row;
}

export async function insertAccessToken(input: {
  refreshTokenId: string | null;
  userId: string;
  oauthClientId: string;
  tokenHash: string;
  scopes: string[];
  expiresAt: Date;
  audience?: string;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_access_tokens (
       refresh_token_id, user_id, oauth_client_id, token_hash, scopes, audience, expires_at
     ) values ($1,$2,$3,$4,$5,$6,$7)
     returning id`,
    [
      input.refreshTokenId,
      input.userId,
      input.oauthClientId,
      input.tokenHash,
      input.scopes,
      input.audience ?? "clauxen-code",
      input.expiresAt.toISOString(),
    ],
  );
  if (!row) throw new Error("Failed to create access token");
  return row;
}

export type AccessTokenRow = {
  id: string;
  user_id: string;
  oauth_client_id: string;
  scopes: string[];
  status: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function findAccessTokenByHash(
  tokenHash: string,
): Promise<AccessTokenRow | null> {
  return queryOne<AccessTokenRow>(
    `select id, user_id, oauth_client_id, scopes, status, expires_at, revoked_at
     from public.oauth_access_tokens
     where token_hash = $1`,
    [tokenHash],
  );
}

export async function touchAccessToken(id: string): Promise<void> {
  await query(
    `update public.oauth_access_tokens set last_used_at = now() where id = $1`,
    [id],
  );
}

export type RefreshTokenRow = {
  id: string;
  family_id: string;
  user_id: string;
  oauth_client_id: string;
  scopes: string[];
  status: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function findRefreshTokenByHash(
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  return queryOne<RefreshTokenRow>(
    `select id, family_id, user_id, oauth_client_id, scopes, status, expires_at, revoked_at
     from public.oauth_refresh_tokens
     where token_hash = $1`,
    [tokenHash],
  );
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await query(
    `update public.oauth_refresh_tokens
     set status = 'revoked', revoked_at = now()
     where id = $1`,
    [id],
  );
}

export async function revokeRefreshFamily(familyId: string): Promise<void> {
  await query(
    `update public.oauth_refresh_token_families
     set status = 'revoked', revoked_at = now()
     where id = $1`,
    [familyId],
  );
  await query(
    `update public.oauth_refresh_tokens
     set status = 'revoked', revoked_at = now()
     where family_id = $1 and status = 'active'`,
    [familyId],
  );
}

export async function revokeAccessTokenByHash(tokenHash: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `update public.oauth_access_tokens
     set status = 'revoked', revoked_at = now()
     where token_hash = $1 and status = 'active'
     returning id`,
    [tokenHash],
  );
  return Boolean(row);
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<boolean> {
  const row = await queryOne<{ id: string; family_id: string }>(
    `update public.oauth_refresh_tokens
     set status = 'revoked', revoked_at = now()
     where token_hash = $1 and status = 'active'
     returning id, family_id`,
    [tokenHash],
  );
  if (!row) return false;
  await revokeRefreshFamily(row.family_id);
  return true;
}

export async function listActiveRefreshTokensForUser(userId: string) {
  return query<{
    id: string;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
    client_name: string;
  }>(
    `select r.id, r.created_at, r.expires_at, r.last_used_at, c.name as client_name
     from public.oauth_refresh_tokens r
     join public.oauth_clients c on c.id = r.oauth_client_id
     where r.user_id = $1 and r.status = 'active' and r.revoked_at is null
       and r.expires_at > now()
     order by r.created_at desc`,
    [userId],
  );
}

export async function insertDeviceCode(input: {
  oauthClientId: string;
  deviceCodeHash: string;
  userCodeHash: string;
  scopes: string[];
  expiresAt: Date;
  intervalSeconds: number;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `insert into public.oauth_device_codes (
       oauth_client_id, device_code_hash, user_code_hash, scopes,
       interval_seconds, expires_at, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     returning id`,
    [
      input.oauthClientId,
      input.deviceCodeHash,
      input.userCodeHash,
      input.scopes,
      input.intervalSeconds,
      input.expiresAt.toISOString(),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  if (!row) throw new Error("Failed to create device code");
  return row;
}

export type DeviceCodeRow = {
  id: string;
  oauth_client_id: string;
  user_id: string | null;
  scopes: string[];
  status: string;
  interval_seconds: number;
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
  metadata: Record<string, unknown>;
};

export async function findDeviceByDeviceCodeHash(
  hash: string,
): Promise<DeviceCodeRow | null> {
  return queryOne<DeviceCodeRow>(
    `select id, oauth_client_id, user_id, scopes, status, interval_seconds,
            expires_at, approved_at, consumed_at, metadata
     from public.oauth_device_codes
     where device_code_hash = $1`,
    [hash],
  );
}

export async function findDeviceByUserCodeHash(
  hash: string,
): Promise<DeviceCodeRow | null> {
  return queryOne<DeviceCodeRow>(
    `select id, oauth_client_id, user_id, scopes, status, interval_seconds,
            expires_at, approved_at, consumed_at, metadata
     from public.oauth_device_codes
     where user_code_hash = $1`,
    [hash],
  );
}

export async function approveDeviceCode(
  id: string,
  userId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `update public.oauth_device_codes
     set user_id = $2, approved_at = now(), status = 'active'
     where id = $1 and approved_at is null and consumed_at is null
       and expires_at > now()
     returning id`,
    [id, userId],
  );
  return Boolean(row);
}

export async function consumeDeviceCode(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `update public.oauth_device_codes
     set consumed_at = now(), status = 'revoked'
     where id = $1 and approved_at is not null and consumed_at is null
       and expires_at > now()
     returning id`,
    [id],
  );
  return Boolean(row);
}

export async function insertOauthEvent(input: {
  userId?: string | null;
  oauthClientId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `insert into public.oauth_events (
       user_id, oauth_client_id, event_type, ip_address, user_agent, metadata
     ) values ($1,$2,$3,nullif($4,'')::inet,$5,$6::jsonb)`,
    [
      input.userId ?? null,
      input.oauthClientId ?? null,
      input.eventType,
      input.ipAddress ?? "",
      input.userAgent ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  ).catch(() => {
    /* audit failures must not break auth */
  });
}
