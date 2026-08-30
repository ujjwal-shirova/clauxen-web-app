import type { Sql } from "postgres";
import {
  openText,
  pkceChallenge,
  randomUrlSafe,
  sealText,
  sha256,
} from "./crypto";
import { withDatabase } from "./db";
import { enqueueAudit } from "./events";
import {
  allowedReturnUrl,
  HttpError,
  httpsUrl,
  json,
  readJsonObject,
  stringField,
} from "./http";

type OAuthConfigRow = {
  connector_id: string;
  connector_key: string;
  connector_name: string;
  provider: string;
  client_id: string;
  encrypted_client_secret: string | null;
  client_secret_nonce: string | null;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string | null;
  api_base_url: string | null;
  client_auth_method: "none" | "client_secret_post" | "client_secret_basic";
  scopes: string[];
  authorization_params: Record<string, unknown>;
  token_params: Record<string, unknown>;
  supports_pkce: boolean;
};

type ClaimedTransaction = {
  id: string;
  connector_id: string;
  user_id: string;
  workspace_id: string | null;
  encrypted_code_verifier: string;
  code_verifier_nonce: string;
  redirect_uri: string;
  return_url: string;
  requested_scopes: string[];
};

type TokenPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  refresh_expires_in?: unknown;
  scope?: unknown;
  [key: string]: unknown;
};

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

function jsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, jsonValue(item)]),
    );
  }
  return null;
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(`${field} must be an array.`, 400, "invalid_body");
  }
  const items = value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > 500) {
      throw new HttpError(
        `${field} contains an invalid value.`,
        400,
        "invalid_body",
      );
    }
    return item.trim();
  });
  return [...new Set(items)].slice(0, 100);
}

function objectField(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = body[key];
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(`${key} must be an object.`, 400, "invalid_body");
  }
  return value as Record<string, unknown>;
}

function safeOAuthParams(
  value: Record<string, unknown>,
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,80}$/.test(key)) continue;
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      output[key] = String(item);
    }
  }
  return output;
}

async function oauthConfigByKey(
  sql: Sql,
  connectorKey: string,
  enabledOnly = true,
): Promise<OAuthConfigRow | null> {
  const rows = await sql<OAuthConfigRow[]>`
    select catalog.id as connector_id, catalog.key as connector_key,
           catalog.name as connector_name, catalog.provider,
           config.client_id, config.encrypted_client_secret,
           config.client_secret_nonce, config.authorization_endpoint,
           config.token_endpoint, config.revocation_endpoint,
           config.api_base_url, config.client_auth_method, config.scopes,
           config.authorization_params, config.token_params,
           config.supports_pkce
    from public.connector_catalog catalog
    join private.connector_oauth_configs config on config.connector_id = catalog.id
    where catalog.key = ${connectorKey}
      and catalog.status in ('active', 'beta')
      and (${enabledOnly} = false or config.enabled = true)
    limit 1
  `;
  return rows[0] ?? null;
}

export async function configureOAuthConnector(
  request: Request,
  env: Env,
  connectorKey: string,
): Promise<Response> {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(connectorKey)) {
    throw new HttpError("Invalid connector key.", 400, "invalid_connector_key");
  }
  const body = await readJsonObject(request);
  const name = stringField(body, "name", { required: true, max: 120 })!;
  const provider = stringField(body, "provider", { required: true, max: 120 })!;
  const clientId = stringField(body, "clientId", {
    required: true,
    max: 1000,
  })!;
  const clientSecret = stringField(body, "clientSecret", { max: 8000 });
  const authorizationEndpoint = httpsUrl(
    stringField(body, "authorizationEndpoint", { required: true })!,
    "authorizationEndpoint",
  );
  const tokenEndpoint = httpsUrl(
    stringField(body, "tokenEndpoint", { required: true })!,
    "tokenEndpoint",
  );
  const revocationRaw = stringField(body, "revocationEndpoint");
  const apiBaseRaw = stringField(body, "apiBaseUrl");
  const clientAuthMethod =
    stringField(body, "clientAuthMethod", { max: 40 }) ?? "client_secret_post";
  if (
    !["none", "client_secret_post", "client_secret_basic"].includes(
      clientAuthMethod,
    )
  ) {
    throw new HttpError(
      "Unsupported OAuth client authentication method.",
      400,
      "invalid_auth_method",
    );
  }
  if (clientAuthMethod !== "none" && !clientSecret) {
    throw new HttpError(
      "clientSecret is required for this authentication method.",
      400,
      "invalid_body",
    );
  }
  const scopes = stringArray(body.scopes, "scopes");
  const authorizationParams = objectField(body, "authorizationParams");
  const tokenParams = objectField(body, "tokenParams");
  const enabled = body.enabled === true;
  const supportsPkce = body.supportsPkce !== false;

  return withDatabase(env, async (sql) => {
    const catalogRows = await sql<{ id: string }[]>`
      insert into public.connector_catalog (
        key, name, provider, auth_type, protocol, scopes, status, metadata
      ) values (
        ${connectorKey}, ${name}, ${provider}, 'oauth2', 'rest', ${scopes},
        'beta', '{}'::jsonb
      )
      on conflict (key) do update set
        name = excluded.name,
        provider = excluded.provider,
        auth_type = 'oauth2',
        scopes = excluded.scopes,
        updated_at = now()
      returning id
    `;
    const connectorId = catalogRows[0]?.id;
    if (!connectorId) throw new Error("Connector catalog upsert failed");

    const sealed = clientSecret
      ? await sealText(
          clientSecret,
          env.CONNECTOR_ENCRYPTION_KEY,
          `oauth-client:${connectorId}`,
        )
      : null;

    await sql`
      insert into private.connector_oauth_configs (
        connector_id, client_id, encrypted_client_secret, client_secret_nonce,
        authorization_endpoint, token_endpoint, revocation_endpoint,
        api_base_url, client_auth_method, scopes, authorization_params,
        token_params, supports_pkce, enabled
      ) values (
        ${connectorId}::uuid, ${clientId}, ${sealed?.ciphertext ?? null},
        ${sealed?.nonce ?? null}, ${authorizationEndpoint}, ${tokenEndpoint},
        ${revocationRaw ? httpsUrl(revocationRaw, "revocationEndpoint") : null},
        ${apiBaseRaw ? httpsUrl(apiBaseRaw, "apiBaseUrl") : null},
        ${clientAuthMethod}, ${scopes}, ${sql.json(safeOAuthParams(authorizationParams))},
        ${sql.json(safeOAuthParams(tokenParams))}, ${supportsPkce}, ${enabled}
      )
      on conflict (connector_id) do update set
        client_id = excluded.client_id,
        encrypted_client_secret = excluded.encrypted_client_secret,
        client_secret_nonce = excluded.client_secret_nonce,
        authorization_endpoint = excluded.authorization_endpoint,
        token_endpoint = excluded.token_endpoint,
        revocation_endpoint = excluded.revocation_endpoint,
        api_base_url = excluded.api_base_url,
        client_auth_method = excluded.client_auth_method,
        scopes = excluded.scopes,
        authorization_params = excluded.authorization_params,
        token_params = excluded.token_params,
        supports_pkce = excluded.supports_pkce,
        enabled = excluded.enabled,
        updated_at = now()
    `;

    return json({ data: { connectorKey, configured: true, enabled } });
  });
}

export async function startOAuth(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userId: string,
): Promise<Response> {
  const body = await readJsonObject(request);
  const connectorKey = stringField(body, "connectorKey", {
    required: true,
    max: 80,
  })!;
  const returnUrl = allowedReturnUrl(
    stringField(body, "returnUrl", { required: true })!,
    env,
  );
  const workspaceId = stringField(body, "workspaceId", { max: 36 });
  if (
    workspaceId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspaceId,
    )
  ) {
    throw new HttpError("Invalid workspaceId.", 400, "invalid_workspace");
  }

  return withDatabase(env, async (sql) => {
    const config = await oauthConfigByKey(sql, connectorKey);
    if (!config) {
      throw new HttpError(
        "This connector has not been configured for OAuth yet.",
        409,
        "connector_not_configured",
      );
    }

    if (workspaceId) {
      const membershipRows = await sql<{ allowed: boolean }[]>`
        select exists (
          select 1
          from public.workspace_members
          where workspace_id = ${workspaceId}::uuid
            and user_id = ${userId}::uuid
            and status = 'active'
        ) as allowed
      `;
      if (!membershipRows[0]?.allowed) {
        throw new HttpError(
          "You cannot install a connector in this workspace.",
          403,
          "workspace_access_denied",
        );
      }
    }

    const recentRows = await sql<{ count: string }[]>`
      select count(*)::text as count
      from private.connector_oauth_transactions
      where user_id = ${userId}::uuid
        and created_at > now() - interval '1 minute'
    `;
    if (Number(recentRows[0]?.count ?? "0") >= 10) {
      throw new HttpError("Too many connection attempts.", 429, "rate_limited");
    }

    const state = randomUrlSafe(32);
    const verifier = randomUrlSafe(48);
    const redirectUri = new URL(
      `/v1/oauth/callback/${encodeURIComponent(connectorKey)}`,
      request.url,
    ).toString();
    const verifierEnvelope = await sealText(
      verifier,
      env.CONNECTOR_ENCRYPTION_KEY,
      `oauth-transaction:${await sha256(state)}`,
    );
    const ttlSeconds = Math.min(
      900,
      Math.max(300, Number(env.OAUTH_TRANSACTION_TTL_SECONDS) || 600),
    );
    const stateHash = await sha256(state);

    await sql`
      insert into private.connector_oauth_transactions (
        state_hash, connector_id, user_id, workspace_id,
        encrypted_code_verifier, code_verifier_nonce, redirect_uri,
        return_url, requested_scopes, expires_at
      ) values (
        ${stateHash}, ${config.connector_id}::uuid, ${userId}::uuid,
        ${workspaceId}::uuid, ${verifierEnvelope.ciphertext},
        ${verifierEnvelope.nonce}, ${redirectUri}, ${returnUrl}, ${config.scopes},
        now() + (${ttlSeconds} * interval '1 second')
      )
    `;

    const authorize = new URL(config.authorization_endpoint);
    const params: Record<string, string> = {
      ...safeOAuthParams(config.authorization_params),
      response_type: "code",
      client_id: config.client_id,
      redirect_uri: redirectUri,
      state,
    };
    if (config.scopes.length > 0) params.scope = config.scopes.join(" ");
    if (config.supports_pkce) {
      params.code_challenge = await pkceChallenge(verifier);
      params.code_challenge_method = "S256";
    }
    for (const [key, value] of Object.entries(params)) {
      authorize.searchParams.set(key, value);
    }

    enqueueAudit(env, ctx, {
      userId,
      workspaceId,
      connectorKey,
      eventType: "oauth_started",
      requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
      status: "succeeded",
      metadata: { workspaceScoped: Boolean(workspaceId) },
    });

    return json({
      data: { authorizeUrl: authorize.toString(), expiresIn: ttlSeconds },
    });
  });
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(
        "Provider response exceeded the safety limit.",
        502,
        "provider_response_too_large",
      );
    }
    chunks.push(next.value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function exchangeAuthorizationCode(
  config: OAuthConfigRow,
  transaction: ClaimedTransaction,
  code: string,
  verifier: string,
  env: Env,
): Promise<TokenPayload> {
  const form = new URLSearchParams({
    ...safeOAuthParams(config.token_params),
    grant_type: "authorization_code",
    code,
    redirect_uri: transaction.redirect_uri,
    client_id: config.client_id,
  });
  if (config.supports_pkce) form.set("code_verifier", verifier);
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded",
  });

  if (config.client_auth_method !== "none") {
    if (!config.encrypted_client_secret || !config.client_secret_nonce) {
      throw new Error("OAuth client secret is unavailable");
    }
    const clientSecret = await openText(
      config.encrypted_client_secret,
      config.client_secret_nonce,
      env.CONNECTOR_ENCRYPTION_KEY,
      `oauth-client:${config.connector_id}`,
    );
    if (config.client_auth_method === "client_secret_basic") {
      headers.set(
        "authorization",
        `Basic ${btoa(`${config.client_id}:${clientSecret}`)}`,
      );
      form.delete("client_id");
    } else {
      form.set("client_secret", clientSecret);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(config.token_endpoint, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await readBoundedResponse(response, 256 * 1024);
  let payload: TokenPayload = {};
  try {
    payload = JSON.parse(responseText) as TokenPayload;
  } catch {
    if (response.ok)
      throw new Error("Provider returned an invalid token response");
  }
  if (!response.ok) {
    const providerCode =
      typeof payload.error === "string"
        ? payload.error
        : "oauth_exchange_failed";
    throw new HttpError(
      `Provider rejected the OAuth exchange (${providerCode}).`,
      502,
      "oauth_exchange_failed",
    );
  }
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new HttpError(
      "Provider did not return an access token.",
      502,
      "invalid_token_response",
    );
  }
  return payload;
}

function redirectWithResult(
  returnUrl: string,
  values: Record<string, string>,
): Response {
  const destination = new URL(returnUrl);
  for (const [key, value] of Object.entries(values)) {
    destination.searchParams.set(key, value);
  }
  return Response.redirect(destination.toString(), 302);
}

export async function finishOAuth(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  connectorKey: string,
): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error");
  if (!state) throw new HttpError("Missing OAuth state.", 400, "missing_state");

  return withDatabase(env, async (sql) => {
    const stateHash = await sha256(state);
    const rows = await sql<ClaimedTransaction[]>`
      select * from private.claim_connector_oauth_transaction(
        ${stateHash}, ${connectorKey}
      )
    `;
    const transaction = rows[0];
    if (!transaction) {
      throw new HttpError(
        "OAuth request is invalid or expired.",
        400,
        "invalid_oauth_state",
      );
    }
    if (providerError || !code) {
      enqueueAudit(env, ctx, {
        userId: transaction.user_id,
        workspaceId: transaction.workspace_id,
        connectorKey,
        eventType: "oauth_denied",
        status: "denied",
        errorCode: providerError ?? "missing_code",
      });
      return redirectWithResult(transaction.return_url, {
        connector: connectorKey,
        connector_error: providerError ?? "authorization_denied",
      });
    }

    const config = await oauthConfigByKey(sql, connectorKey);
    if (!config || config.connector_id !== transaction.connector_id) {
      return redirectWithResult(transaction.return_url, {
        connector: connectorKey,
        connector_error: "connector_not_configured",
      });
    }

    try {
      const verifier = await openText(
        transaction.encrypted_code_verifier,
        transaction.code_verifier_nonce,
        env.CONNECTOR_ENCRYPTION_KEY,
        `oauth-transaction:${stateHash}`,
      );
      const token = await exchangeAuthorizationCode(
        config,
        transaction,
        code,
        verifier,
        env,
      );

      const installationRows = await sql<{ id: string }[]>`
        insert into public.connector_installations (
          connector_id, user_id, workspace_id, status, granted_scopes, connected_at
        ) values (
          ${config.connector_id}::uuid, ${transaction.user_id}::uuid,
          ${transaction.workspace_id}::uuid, 'pending', ${transaction.requested_scopes}, now()
        )
        on conflict do nothing
        returning id
      `;
      let installationId = installationRows[0]?.id;
      if (!installationId) {
        const existingRows = await sql<{ id: string }[]>`
          select id from public.connector_installations
          where connector_id = ${config.connector_id}::uuid
            and user_id = ${transaction.user_id}::uuid
            and workspace_id is not distinct from ${transaction.workspace_id}::uuid
          limit 1
        `;
        installationId = existingRows[0]?.id;
      }
      if (!installationId)
        throw new Error("Connector installation could not be created");

      const access = await sealText(
        token.access_token as string,
        env.CONNECTOR_ENCRYPTION_KEY,
        `installation:${installationId}:access`,
      );
      const refresh =
        typeof token.refresh_token === "string" && token.refresh_token
          ? await sealText(
              token.refresh_token,
              env.CONNECTOR_ENCRYPTION_KEY,
              `installation:${installationId}:refresh`,
            )
          : null;
      const expiresIn = Number(token.expires_in);
      const refreshExpiresIn = Number(token.refresh_expires_in);
      const grantedScopes =
        typeof token.scope === "string"
          ? token.scope.split(/[ ,]+/).filter(Boolean)
          : transaction.requested_scopes;
      const safeProviderMetadata = Object.fromEntries(
        Object.entries(token).filter(
          ([key]) =>
            !["access_token", "refresh_token", "id_token"].includes(key),
        ),
      );

      await sql.begin(async (transactionSql) => {
        await transactionSql`
          insert into private.connector_credentials (
            installation_id, encrypted_access_token, access_token_nonce,
            encrypted_refresh_token, refresh_token_nonce, token_type,
            expires_at, refresh_expires_at, provider_metadata
          ) values (
            ${installationId}::uuid, ${access.ciphertext}, ${access.nonce},
            ${refresh?.ciphertext ?? null}, ${refresh?.nonce ?? null},
            ${typeof token.token_type === "string" ? token.token_type : "Bearer"},
            ${Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000) : null},
            ${Number.isFinite(refreshExpiresIn) ? new Date(Date.now() + refreshExpiresIn * 1000) : null},
            ${transactionSql.json(jsonValue(safeProviderMetadata))}
          )
          on conflict (installation_id) do update set
            encrypted_access_token = excluded.encrypted_access_token,
            access_token_nonce = excluded.access_token_nonce,
            encrypted_refresh_token = coalesce(
              excluded.encrypted_refresh_token,
              private.connector_credentials.encrypted_refresh_token
            ),
            refresh_token_nonce = coalesce(
              excluded.refresh_token_nonce,
              private.connector_credentials.refresh_token_nonce
            ),
            token_type = excluded.token_type,
            expires_at = excluded.expires_at,
            refresh_expires_at = excluded.refresh_expires_at,
            provider_metadata = excluded.provider_metadata,
            refresh_lock_id = null,
            refresh_locked_until = null,
            updated_at = now()
        `;
        await transactionSql`
          update public.connector_installations
          set status = 'active', granted_scopes = ${grantedScopes},
              connected_at = now(), last_error_code = null,
              last_error_at = null, updated_at = now()
          where id = ${installationId}::uuid
        `;
      });

      enqueueAudit(env, ctx, {
        userId: transaction.user_id,
        workspaceId: transaction.workspace_id,
        installationId,
        connectorKey,
        eventType: "oauth_connected",
        status: "succeeded",
        metadata: { scopes: grantedScopes },
      });

      return redirectWithResult(transaction.return_url, {
        connector: connectorKey,
        connector_connected: "1",
      });
    } catch (error) {
      const codeValue =
        error instanceof HttpError ? error.code : "oauth_callback_failed";
      enqueueAudit(env, ctx, {
        userId: transaction.user_id,
        workspaceId: transaction.workspace_id,
        connectorKey,
        eventType: "oauth_failed",
        status: "failed",
        errorCode: codeValue,
      });
      return redirectWithResult(transaction.return_url, {
        connector: connectorKey,
        connector_error: codeValue,
      });
    }
  });
}

export { oauthConfigByKey, openText, readBoundedResponse, sealText };
export type { OAuthConfigRow };
