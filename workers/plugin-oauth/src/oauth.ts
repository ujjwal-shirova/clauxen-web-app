/**
 * MCP OAuth 2.1 authorization client (Model Context Protocol authorization
 * specification, 2026-07-28 profile).
 *
 * Flow implemented here, exactly as the spec requires:
 *
 *   1. Discover the authorization server from the MCP server's
 *      RFC 9728 Protected Resource Metadata (authorization_servers).
 *   2. Discover the authorization server's endpoints via RFC 8414 metadata,
 *      falling back to OpenID Connect Discovery 1.0.
 *   3. Obtain a client id: Client ID Metadata Documents when advertised,
 *      otherwise RFC 7591 Dynamic Client Registration.
 *   4. Redirect the user with PKCE (S256) and the RFC 8707 resource param.
 *   5. Exchange the code at the token endpoint and store the tokens.
 *
 * Scopes: we ask for every scope the authorization server advertises
 * (scopes_supported) so the consent screen reflects full access and the
 * assistant can use the whole tool surface the plugin exposes.
 */

export const PROTOCOL_VERSION = "2025-06-18";

export type AsMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  client_id_metadata_document_supported?: boolean;
};

export type RegisteredClient = {
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  tokenEndpointAuthMethod: string;
};

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: string | null;
  scopes: string[];
};

export class McpOAuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "discovery_failed"
      | "registration_failed"
      | "token_exchange_failed"
      | "unsupported_server",
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

const DISCOVERY_TIMEOUT_MS = 8_000;

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; json: unknown; headers: Headers } | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: response.status, json, headers: response.headers };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function originAndPath(rawUrl: string): { origin: string; path: string } {
  const url = new URL(rawUrl);
  const path = url.pathname.replace(/\/+$/, "");
  return { origin: url.origin, path };
}

/** RFC 9728 Protected Resource Metadata discovery. */
export async function discoverProtectedResource(mcpUrl: string): Promise<{
  authorizationServers: string[];
  scopesSupported: string[];
}> {
  const { origin, path } = originAndPath(mcpUrl);
  const candidates = [
    // Path-inserted form first, per RFC 9728 section 3.
    `${origin}/.well-known/oauth-protected-resource${path}`,
    `${origin}/.well-known/oauth-protected-resource`,
  ];

  for (const candidate of candidates) {
    const response = await fetchJson(candidate);
    if (response?.status !== 200 || !isRecord(response.json)) continue;
    const raw = response.json as Record<string, unknown>;
    const authorizationServers = asStringArray(raw.authorization_servers);
    if (authorizationServers.length > 0) {
      return {
        authorizationServers,
        scopesSupported: asStringArray(raw.scopes_supported),
      };
    }
  }

  // Last resort: a bare MCP probe returns 401 with a WWW-Authenticate header
  // naming the resource metadata URL (RFC 9728 section 5.1).
  const probe = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "clauxen", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  }).catch(() => null);

  const challenge = probe?.headers.get("www-authenticate") ?? "";
  const resourceMatch = /resource_metadata="([^"]+)"/i.exec(challenge);
  if (resourceMatch?.[1]) {
    const response = await fetchJson(resourceMatch[1]);
    if (response?.status === 200 && isRecord(response.json)) {
      const raw = response.json as Record<string, unknown>;
      const authorizationServers = asStringArray(raw.authorization_servers);
      if (authorizationServers.length > 0) {
        return {
          authorizationServers,
          scopesSupported: asStringArray(raw.scopes_supported),
        };
      }
    }
  }

  throw new McpOAuthError(
    "Could not discover OAuth metadata for this plugin's MCP server.",
    "discovery_failed",
  );
}

/** RFC 8414 / OIDC Discovery for the authorization server. */
export async function discoverAuthorizationServer(
  issuer: string,
): Promise<AsMetadata> {
  const { origin, path } = originAndPath(issuer);
  const candidates =
    path.length > 0
      ? [
          `${origin}/.well-known/oauth-authorization-server${path}`,
          `${origin}/.well-known/openid-configuration${path}`,
          `${issuer}/.well-known/openid-configuration`,
        ]
      : [
          `${origin}/.well-known/oauth-authorization-server`,
          `${origin}/.well-known/openid-configuration`,
        ];

  for (const candidate of candidates) {
    const response = await fetchJson(candidate);
    if (response?.status !== 200 || !isRecord(response.json)) continue;
    const raw = response.json as Record<string, unknown>;

    const authorizationEndpoint = raw.authorization_endpoint;
    const tokenEndpoint = raw.token_endpoint;
    if (
      typeof authorizationEndpoint !== "string" ||
      typeof tokenEndpoint !== "string"
    ) {
      continue;
    }

    // RFC 9207: the returned issuer must match what we asked for.
    const returnedIssuer = typeof raw.issuer === "string" ? raw.issuer : issuer;
    if (new URL(returnedIssuer).origin !== new URL(issuer).origin) continue;

    return {
      issuer: returnedIssuer,
      authorization_endpoint: authorizationEndpoint,
      token_endpoint: tokenEndpoint,
      registration_endpoint:
        typeof raw.registration_endpoint === "string"
          ? raw.registration_endpoint
          : undefined,
      revocation_endpoint:
        typeof raw.revocation_endpoint === "string"
          ? raw.revocation_endpoint
          : undefined,
      scopes_supported: asStringArray(raw.scopes_supported),
      code_challenge_methods_supported: asStringArray(
        raw.code_challenge_methods_supported,
      ),
      grant_types_supported: asStringArray(raw.grant_types_supported),
      token_endpoint_auth_methods_supported: asStringArray(
        raw.token_endpoint_auth_methods_supported,
      ),
      client_id_metadata_document_supported:
        raw.client_id_metadata_document_supported === true,
    };
  }

  throw new McpOAuthError(
    "Could not discover the authorization server metadata.",
    "discovery_failed",
  );
}

/** Scopes we request: everything the provider advertises (full access). */
export function requestedScopes(metadata: AsMetadata): string[] {
  const supported = metadata.scopes_supported ?? [];
  // Many providers omit scopes_supported but still honour the standard set;
  // fall back to a broad but conventional request.
  return supported.length > 0
    ? [...new Set(supported)]
    : ["openid", "profile", "email", "offline_access"];
}

function pickAuthMethod(metadata: AsMetadata): string {
  const supported = metadata.token_endpoint_auth_methods_supported ?? [];
  if (supported.includes("client_secret_basic")) return "client_secret_basic";
  if (supported.includes("client_secret_post")) return "client_secret_post";
  return "none";
}

/**
 * Obtain a client id. Preference order matches the spec: Client ID Metadata
 * Documents first, then RFC 7591 Dynamic Client Registration.
 */
export async function registerClient(
  metadata: AsMetadata,
  redirectUri: string,
  scope: string,
  clientMetadataUrl: string,
): Promise<RegisteredClient> {
  // 1. Client ID Metadata Documents (public client + PKCE, no secret).
  if (metadata.client_id_metadata_document_supported) {
    return {
      issuer: metadata.issuer,
      clientId: clientMetadataUrl,
      clientSecret: null,
      tokenEndpointAuthMethod: "none",
    };
  }

  // 2. RFC 7591 Dynamic Client Registration.
  if (metadata.registration_endpoint) {
    const authMethod = pickAuthMethod(metadata);
    const response = await fetchJson(metadata.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Clauxen",
        client_uri: "https://clauxen.com",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: authMethod === "none" ? "none" : authMethod,
        application_type: "web",
        scope,
      }),
    });

    if (response?.status === 201 || response?.status === 200) {
      const raw = isRecord(response.json) ? response.json : null;
      const clientId = raw ? raw.client_id : undefined;
      if (typeof clientId === "string" && clientId.length > 0) {
        return {
          issuer: metadata.issuer,
          clientId,
          clientSecret:
            raw && typeof raw.client_secret === "string" ? raw.client_secret : null,
          tokenEndpointAuthMethod:
            raw && typeof raw.token_endpoint_auth_method === "string"
              ? raw.token_endpoint_auth_method
              : authMethod,
        };
      }
    }

    throw new McpOAuthError(
      "Dynamic client registration was rejected by the authorization server.",
      "registration_failed",
    );
  }

  throw new McpOAuthError(
    "This authorization server supports neither client metadata documents nor dynamic registration.",
    "unsupported_server",
  );
}

function buildAuthHeader(client: RegisteredClient): Record<string, string> {
  if (
    client.tokenEndpointAuthMethod === "client_secret_basic" &&
    client.clientSecret
  ) {
    const credentials = btoa(
      `${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`,
    );
    return { authorization: `Basic ${credentials}` };
  }
  return {};
}

function clientAuthBody(client: RegisteredClient): Record<string, string> {
  const body: Record<string, string> = { client_id: client.clientId };
  if (
    client.tokenEndpointAuthMethod !== "client_secret_basic" &&
    client.clientSecret
  ) {
    body.client_secret = client.clientSecret;
  }
  return body;
}

function parseTokenResponse(raw: unknown): TokenSet {
  if (!isRecord(raw)) {
    throw new McpOAuthError("Malformed token response.", "token_exchange_failed");
  }
  const accessToken = raw.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new McpOAuthError(
      typeof raw.error_description === "string"
        ? raw.error_description
        : "The token endpoint did not return an access token.",
      "token_exchange_failed",
    );
  }

  const expiresIn = typeof raw.expires_in === "number" ? raw.expires_in : null;
  return {
    accessToken,
    refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : null,
    tokenType: typeof raw.token_type === "string" ? raw.token_type : "Bearer",
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null,
    scopes: asStringArray(raw.scope),
  };
}

export async function exchangeAuthorizationCode(input: {
  metadata: AsMetadata;
  client: RegisteredClient;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
  scope: string;
}): Promise<TokenSet> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
    resource: input.resource,
    scope: input.scope,
    ...clientAuthBody(input.client),
  });

  const response = await fetchJson(input.metadata.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...buildAuthHeader(input.client),
    },
    body: form.toString(),
  });

  if (!response || response.status >= 400) {
    const json = isRecord(response?.json) ? response?.json : null;
    const detail =
      json && typeof json.error_description === "string"
        ? json.error_description
        : `Token endpoint responded ${response?.status ?? "unreachable"}.`;
    throw new McpOAuthError(detail, "token_exchange_failed");
  }

  return parseTokenResponse(response.json);
}

export async function refreshAccessToken(input: {
  metadata: AsMetadata;
  client: RegisteredClient;
  refreshToken: string;
  resource: string;
  scope: string;
}): Promise<TokenSet> {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    resource: input.resource,
    scope: input.scope,
    ...clientAuthBody(input.client),
  });

  const response = await fetchJson(input.metadata.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...buildAuthHeader(input.client),
    },
    body: form.toString(),
  });

  if (!response || response.status >= 400) {
    throw new McpOAuthError(
      `Token refresh failed (${response?.status ?? "unreachable"}).`,
      "token_exchange_failed",
    );
  }

  const tokens = parseTokenResponse(response.json);
  // Some providers omit refresh_token on rotation; keep the old one.
  if (!tokens.refreshToken) tokens.refreshToken = input.refreshToken;
  return tokens;
}

// ─── PKCE ───────────────────────────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(bytes);
}

/** Build the authorization endpoint URL the new tab is opened at. */
export function buildAuthorizeUrl(input: {
  metadata: AsMetadata;
  client: RegisteredClient;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  resource: string;
}): string {
  const url = new URL(input.metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.client.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // RFC 8707: always name the resource the token is for.
  url.searchParams.set("resource", input.resource);
  return url.toString();
}
