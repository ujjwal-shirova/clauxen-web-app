import { withTransaction } from "@/server/db/pool";
import { sealSecret, unsealSecret } from "@/server/plugins/token-crypto";
import {
  providerCredentials,
  type OAuthProviderId,
} from "@/server/plugins/oauth-providers";
import * as repo from "@/server/repositories/plugin-connections.repository";
import type {
  OAuthMeta,
  PluginConnectionRow,
  SealedTokens,
} from "@/server/repositories/plugin-connections.repository";

export type TokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: string | null;
  scopes: string[];
};

export type ClientAuth = {
  clientId: string;
  clientSecret: string | null;
  tokenAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
};

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * POST to an OAuth token endpoint (authorization_code or refresh_token).
 * Throws when the provider does not return a real access token.
 */
export async function requestToken(
  tokenEndpoint: string,
  params: Record<string, string>,
  client: ClientAuth,
): Promise<TokenResponse> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  const body = new URLSearchParams(params);
  if (client.tokenAuthMethod === "client_secret_basic" && client.clientSecret) {
    headers.authorization = `Basic ${btoa(
      `${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`,
    )}`;
  } else {
    body.set("client_id", client.clientId);
    if (client.clientSecret) body.set("client_secret", client.clientSecret);
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text);
    json = parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // GitHub can answer form-encoded when the accept header is ignored.
    const form = new URLSearchParams(text);
    if (form.has("access_token") || form.has("error")) {
      json = Object.fromEntries(form.entries());
    }
  }

  // Slack's user-token flow nests the token under authed_user.
  const authedUser =
    json && typeof json.authed_user === "object" && json.authed_user !== null
      ? (json.authed_user as Record<string, unknown>)
      : null;
  const accessToken = readString(json, "access_token") ?? readString(authedUser, "access_token");

  if (!response.ok || !accessToken || json?.ok === false) {
    const reason =
      readString(json, "error_description") ?? readString(json, "error") ?? `HTTP ${response.status}`;
    throw new Error(`The provider did not issue a token (${reason}).`);
  }

  const source = readString(json, "access_token") ? json : authedUser;
  const expiresIn = Number(source?.expires_in);
  const scope = readString(source, "scope") ?? "";
  return {
    accessToken,
    refreshToken: readString(source, "refresh_token"),
    tokenType: readString(source, "token_type") ?? "Bearer",
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
    scopes: scope.split(/[\s,]+/).filter(Boolean),
  };
}

/** Client credentials for refreshing a stored connection. */
export async function clientAuthForMeta(
  meta: OAuthMeta,
  clientSecretSealed: string | null,
): Promise<ClientAuth | null> {
  const provider = (meta.provider ?? null) as OAuthProviderId | null;
  if (provider) {
    const credentials = providerCredentials(provider);
    if (!credentials) return null;
    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      tokenAuthMethod: meta.tokenAuthMethod ?? "client_secret_post",
    };
  }
  if (!meta.clientId) return null;
  return {
    clientId: meta.clientId,
    clientSecret: clientSecretSealed ? await unsealSecret(clientSecretSealed) : null,
    tokenAuthMethod: meta.tokenAuthMethod ?? "none",
  };
}

function expiresSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  // Refresh a minute early so a mid-turn expiry never reaches the model.
  return !Number.isNaN(at) && at - 60_000 < Date.now();
}

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "reauthorization_required" | "unavailable" };

async function refreshLocked(
  connection: PluginConnectionRow,
  force: boolean,
): Promise<AccessTokenResult> {
  return withTransaction(async (client) => {
    const current = await repo.lockSealedTokens(client, connection.id);
    if (!current) return { ok: false, reason: "reauthorization_required" } as const;

    // Another request may have refreshed while this one waited for the lock.
    if (!force && !expiresSoon(current.expires_at)) {
      const token = await unsealSecret(current.access_token_sealed);
      return token
        ? ({ ok: true, accessToken: token } as const)
        : ({ ok: false, reason: "reauthorization_required" } as const);
    }

    const refreshToken = current.refresh_token_sealed
      ? await unsealSecret(current.refresh_token_sealed)
      : null;
    const meta = current.oauth_meta ?? {};
    const clientAuth = await clientAuthForMeta(meta, current.client_secret_sealed);
    if (!refreshToken || !meta.tokenEndpoint || !clientAuth) {
      return { ok: false, reason: "reauthorization_required" } as const;
    }

    let next: TokenResponse;
    try {
      next = await requestToken(
        meta.tokenEndpoint,
        {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          ...(meta.resource ? { resource: meta.resource } : {}),
        },
        clientAuth,
      );
    } catch {
      return { ok: false, reason: "reauthorization_required" } as const;
    }

    await repo.rotateSealedTokens(client, connection.id, {
      accessTokenSealed: await sealSecret(next.accessToken),
      refreshTokenSealed: next.refreshToken ? await sealSecret(next.refreshToken) : null,
      expiresAt: next.expiresAt,
      tokenType: next.tokenType,
    });
    return { ok: true, accessToken: next.accessToken } as const;
  });
}

/**
 * A usable access token for a connection, refreshing it when it is about to
 * expire. Connections to public MCP servers have no token.
 */
export async function getAccessToken(
  connection: PluginConnectionRow,
  options: { forceRefresh?: boolean } = {},
): Promise<AccessTokenResult> {
  if (connection.auth_type === "none") return { ok: true, accessToken: "" };

  const sealed: SealedTokens | null = await repo.readSealedTokens(connection.id);
  if (!sealed) return { ok: false, reason: "reauthorization_required" };

  if (!options.forceRefresh && !expiresSoon(sealed.expires_at)) {
    const token = await unsealSecret(sealed.access_token_sealed);
    return token ? { ok: true, accessToken: token } : { ok: false, reason: "reauthorization_required" };
  }

  try {
    const refreshed = await refreshLocked(connection, Boolean(options.forceRefresh));
    if (!refreshed.ok) await repo.setConnectionStatus(connection.id, "reauthorization_required");
    return refreshed;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Plaintext tokens, used only to redact them from output and to revoke. */
export async function readPlainTokens(
  connectionId: string,
): Promise<{ accessToken: string | null; refreshToken: string | null; meta: OAuthMeta; clientSecretSealed: string | null } | null> {
  const sealed = await repo.readSealedTokens(connectionId);
  if (!sealed) return null;
  return {
    accessToken: await unsealSecret(sealed.access_token_sealed),
    refreshToken: sealed.refresh_token_sealed
      ? await unsealSecret(sealed.refresh_token_sealed)
      : null,
    meta: sealed.oauth_meta ?? {},
    clientSecretSealed: sealed.client_secret_sealed,
  };
}
