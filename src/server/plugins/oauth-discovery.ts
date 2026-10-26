import { sealSecret, unsealSecret } from "@/server/plugins/token-crypto";
import { query, queryOne } from "@/server/db/pool";

/**
 * OAuth discovery for remote MCP servers (MCP authorization specification).
 *
 *   1. RFC 9728 Protected Resource Metadata names the authorization server.
 *   2. RFC 8414 / OpenID discovery returns that server's endpoints.
 *   3. A client id comes from (in order) a pre-registered provider app, a
 *      Client ID Metadata Document, or RFC 7591 dynamic registration.
 *
 * All metadata URLs are validated before fetching so a hostile MCP server
 * cannot point the app at internal addresses.
 */

export const MCP_PROTOCOL_VERSION = "2025-06-18";
const TIMEOUT_MS = 8_000;

export class PluginOAuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_url"
      | "discovery_failed"
      | "registration_unavailable"
      | "token_exchange_failed"
      | "server_unreachable",
  ) {
    super(message);
    this.name = "PluginOAuthError";
  }
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[/,
];

/** Reject anything that is not a public https URL. */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PluginOAuthError("Invalid URL in OAuth metadata.", "invalid_url");
  }
  if (url.protocol !== "https:") {
    throw new PluginOAuthError("OAuth endpoints must use https.", "invalid_url");
  }
  if (url.username || url.password) {
    throw new PluginOAuthError("OAuth endpoints cannot embed credentials.", "invalid_url");
  }
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new PluginOAuthError("OAuth endpoints must be public.", "invalid_url");
  }
  return url;
}

type FetchedJson = { status: number; json: Record<string, unknown> | null; headers: Headers };

async function fetchJson(url: string, init?: RequestInit): Promise<FetchedJson | null> {
  try {
    assertPublicHttpsUrl(url);
    const response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.url) assertPublicHttpsUrl(response.url);
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      const parsed = text ? JSON.parse(text) : null;
      json = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, headers: response.headers };
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ─── probe ──────────────────────────────────────────────────────────────────

export type McpProbe =
  | { kind: "public" }
  | { kind: "oauth"; resourceMetadataUrl: string | null };

/**
 * Send an unauthenticated `initialize`. A 2xx means the server needs no
 * authorization; a 401 names the protected-resource metadata to follow.
 */
export async function probeMcpServer(mcpUrl: string): Promise<McpProbe> {
  assertPublicHttpsUrl(mcpUrl);
  let response: Response;
  try {
    response = await fetch(mcpUrl, {
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
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "clauxen", version: "1.0.0" },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PluginOAuthError(
      "This plugin's server could not be reached. Try again in a moment.",
      "server_unreachable",
    );
  }
  await response.body?.cancel().catch(() => undefined);

  if (response.ok) return { kind: "public" };
  if (response.status === 401 || response.status === 403) {
    const challenge = response.headers.get("www-authenticate") ?? "";
    const match = /resource_metadata="([^"]+)"/i.exec(challenge);
    return { kind: "oauth", resourceMetadataUrl: match?.[1] ?? null };
  }
  throw new PluginOAuthError(
    `This plugin's server responded with ${response.status}.`,
    "server_unreachable",
  );
}

// ─── metadata ───────────────────────────────────────────────────────────────

export type ProtectedResource = {
  resource: string;
  authorizationServers: string[];
  scopesSupported: string[];
};

export async function discoverProtectedResource(
  mcpUrl: string,
  hintedMetadataUrl: string | null,
): Promise<ProtectedResource> {
  const url = assertPublicHttpsUrl(mcpUrl);
  const path = url.pathname.replace(/\/+$/, "");
  const candidates = [
    ...(hintedMetadataUrl ? [hintedMetadataUrl] : []),
    `${url.origin}/.well-known/oauth-protected-resource${path}`,
    `${url.origin}/.well-known/oauth-protected-resource`,
  ];

  for (const candidate of candidates) {
    const fetched = await fetchJson(candidate);
    if (fetched?.status !== 200 || !fetched.json) continue;
    const authorizationServers = strings(fetched.json.authorization_servers);
    if (authorizationServers.length === 0) continue;
    return {
      resource: str(fetched.json.resource) ?? mcpUrl,
      authorizationServers,
      scopesSupported: strings(fetched.json.scopes_supported),
    };
  }

  // Older servers host authorization metadata at their own origin.
  return {
    resource: mcpUrl,
    authorizationServers: [url.origin],
    scopesSupported: [],
  };
}

export type AuthorizationServer = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string | null;
  revocationEndpoint: string | null;
  scopesSupported: string[];
  tokenEndpointAuthMethods: string[];
  supportsClientIdMetadataDocument: boolean;
};

export async function discoverAuthorizationServer(
  issuer: string,
): Promise<AuthorizationServer> {
  const url = assertPublicHttpsUrl(issuer);
  const path = url.pathname.replace(/\/+$/, "");
  const candidates = path
    ? [
        `${url.origin}/.well-known/oauth-authorization-server${path}`,
        `${url.origin}/.well-known/openid-configuration${path}`,
        `${url.origin}${path}/.well-known/openid-configuration`,
      ]
    : [
        `${url.origin}/.well-known/oauth-authorization-server`,
        `${url.origin}/.well-known/openid-configuration`,
      ];

  for (const candidate of candidates) {
    const fetched = await fetchJson(candidate);
    if (fetched?.status !== 200 || !fetched.json) continue;
    const meta = fetched.json;
    const authorizationEndpoint = str(meta.authorization_endpoint);
    const tokenEndpoint = str(meta.token_endpoint);
    if (!authorizationEndpoint || !tokenEndpoint) continue;
    assertPublicHttpsUrl(authorizationEndpoint);
    assertPublicHttpsUrl(tokenEndpoint);
    const registrationEndpoint = str(meta.registration_endpoint);
    const revocationEndpoint = str(meta.revocation_endpoint);
    return {
      issuer: str(meta.issuer) ?? issuer,
      authorizationEndpoint,
      tokenEndpoint,
      registrationEndpoint:
        registrationEndpoint && safeUrl(registrationEndpoint) ? registrationEndpoint : null,
      revocationEndpoint:
        revocationEndpoint && safeUrl(revocationEndpoint) ? revocationEndpoint : null,
      scopesSupported: strings(meta.scopes_supported),
      tokenEndpointAuthMethods: strings(meta.token_endpoint_auth_methods_supported),
      supportsClientIdMetadataDocument:
        meta.client_id_metadata_document_supported === true,
    };
  }

  throw new PluginOAuthError(
    "This plugin's authorization server could not be discovered.",
    "discovery_failed",
  );
}

function safeUrl(raw: string): boolean {
  try {
    assertPublicHttpsUrl(raw);
    return true;
  } catch {
    return false;
  }
}

// ─── client registration ────────────────────────────────────────────────────

export type RegisteredClient = {
  clientId: string;
  clientSecret: string | null;
  tokenAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
};

function normalizeAuthMethod(value: string | null | undefined): RegisteredClient["tokenAuthMethod"] {
  if (value === "client_secret_basic" || value === "client_secret_post") return value;
  return "none";
}

/**
 * Obtain a client id for an authorization server that has no pre-registered
 * Clauxen app: a Client ID Metadata Document when supported, otherwise a
 * cached RFC 7591 dynamic registration.
 */
export async function obtainDynamicClient(
  server: AuthorizationServer,
  redirectUri: string,
  clientMetadataUrl: string,
): Promise<RegisteredClient> {
  if (server.supportsClientIdMetadataDocument && clientMetadataUrl.startsWith("https://")) {
    return { clientId: clientMetadataUrl, clientSecret: null, tokenAuthMethod: "none" };
  }

  const cached = await queryOne<{
    client_id: string;
    client_secret_sealed: string | null;
    token_endpoint_auth_method: string;
  }>(
    `select client_id, client_secret_sealed, token_endpoint_auth_method
       from private.plugin_oauth_clients
      where issuer = $1 and redirect_uri = $2`,
    [server.issuer, redirectUri],
  );
  if (cached) {
    return {
      clientId: cached.client_id,
      clientSecret: cached.client_secret_sealed
        ? await unsealSecret(cached.client_secret_sealed)
        : null,
      tokenAuthMethod: normalizeAuthMethod(cached.token_endpoint_auth_method),
    };
  }

  if (!server.registrationEndpoint) {
    throw new PluginOAuthError(
      "This provider requires a pre-registered OAuth app before it can be connected.",
      "registration_unavailable",
    );
  }

  const preferPublic =
    server.tokenEndpointAuthMethods.length === 0 ||
    server.tokenEndpointAuthMethods.includes("none");
  const fetched = await fetchJson(server.registrationEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Clauxen",
      client_uri: new URL(redirectUri).origin,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: preferPublic ? "none" : "client_secret_post",
    }),
  });
  const clientId = str(fetched?.json?.client_id);
  if (!fetched || fetched.status >= 300 || !clientId) {
    throw new PluginOAuthError(
      "This provider declined Clauxen's client registration.",
      "registration_unavailable",
    );
  }
  const clientSecret = str(fetched.json?.client_secret);
  const tokenAuthMethod = normalizeAuthMethod(
    str(fetched.json?.token_endpoint_auth_method) ??
      (clientSecret ? "client_secret_post" : "none"),
  );

  await query(
    `insert into private.plugin_oauth_clients (
       issuer, redirect_uri, client_id, client_secret_sealed, token_endpoint_auth_method
     ) values ($1, $2, $3, $4, $5)
     on conflict (issuer, redirect_uri) do nothing`,
    [
      server.issuer,
      redirectUri,
      clientId,
      clientSecret ? await sealSecret(clientSecret) : null,
      tokenAuthMethod,
    ],
  );

  return { clientId, clientSecret, tokenAuthMethod };
}
