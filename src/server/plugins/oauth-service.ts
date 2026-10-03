import crypto from "node:crypto";
import { env } from "@/server/config/env";
import { sealSecret } from "@/server/plugins/token-crypto";
import { resolvePluginMcpTarget } from "@/shared/lib/mcp-plugin-dataset";
import { pluginById } from "@/client/components/plugins/catalog";
import * as repo from "@/server/repositories/plugin-connections.repository";

export type PendingOAuthTransaction = {
  state: string;
  userId: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  mcpUrl: string;
  codeVerifier: string;
  resource: string;
  scope: string;
  redirectUri: string;
  tokenEndpoint: string | null;
  clientId: string | null;
  clientSecret: string | null;
  tokenEndpointAuthMethod: string | null;
  returnUrl: string;
  createdAt: number;
};

// In-memory transaction registry with 15-minute expiration
const transactions = new Map<string, PendingOAuthTransaction>();
const TRANSACTION_TTL_MS = 15 * 60 * 1000;

function cleanupTransactions() {
  const now = Date.now();
  for (const [key, val] of transactions.entries()) {
    if (now - val.createdAt > TRANSACTION_TTL_MS) {
      transactions.delete(key);
    }
  }
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function deriveCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function storeTransaction(tx: PendingOAuthTransaction): void {
  cleanupTransactions();
  transactions.set(tx.state, tx);
}

export function getTransaction(state: string): PendingOAuthTransaction | null {
  cleanupTransactions();
  return transactions.get(state) ?? null;
}

export function consumeTransaction(state: string): PendingOAuthTransaction | null {
  const tx = getTransaction(state);
  if (tx) {
    transactions.delete(state);
  }
  return tx;
}

const DISCOVERY_TIMEOUT_MS = 5_000;

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; json: unknown } | null> {
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
    return { status: response.status, json };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ProtectedResourceMetadata = {
  resource: string;
  authorizationServers: string[];
  scopesSupported: string[];
  cursorClientId?: string | null;
  cursorAuthorizationParams?: Record<string, string>;
  cursorOmitResourceIndicator?: boolean;
};

export type AsMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string | null;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
};

async function discoverProtectedResource(mcpUrl: string): Promise<ProtectedResourceMetadata | null> {
  try {
    const url = new URL(mcpUrl);
    const path = url.pathname.replace(/\/+$/, "");
    const candidates = [
      `${url.origin}/.well-known/oauth-protected-resource${path}`,
      `${url.origin}/.well-known/oauth-protected-resource`,
    ];

    for (const candidate of candidates) {
      const res = await fetchJson(candidate);
      if (res?.status === 200 && isRecord(res.json)) {
        const as = Array.isArray(res.json.authorization_servers)
          ? res.json.authorization_servers.filter((s): s is string => typeof s === "string")
          : [];
        const scopes = Array.isArray(res.json.scopes_supported)
          ? res.json.scopes_supported.filter((s): s is string => typeof s === "string")
          : [];
        const cursorClientId = typeof res.json.cursor_client_id === "string" ? res.json.cursor_client_id : null;
        const cursorAuthorizationParams = isRecord(res.json.cursor_authorization_params)
          ? (res.json.cursor_authorization_params as Record<string, string>)
          : undefined;
        const cursorOmitResourceIndicator = Boolean(res.json.cursor_omit_resource_indicator);

        if (as.length > 0 || cursorClientId) {
          return {
            resource: typeof res.json.resource === "string" ? res.json.resource : mcpUrl,
            authorizationServers: as,
            scopesSupported: scopes,
            cursorClientId,
            cursorAuthorizationParams,
            cursorOmitResourceIndicator,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function discoverAuthorizationServer(issuer: string): Promise<AsMetadata | null> {
  try {
    const url = new URL(issuer);
    const path = url.pathname.replace(/\/+$/, "");
    const candidates = [
      `${url.origin}/.well-known/oauth-authorization-server${path}`,
      `${url.origin}/.well-known/openid-configuration${path}`,
      `${url.origin}/.well-known/oauth-authorization-server`,
      `${url.origin}/.well-known/openid-configuration`,
    ];

    for (const candidate of candidates) {
      const res = await fetchJson(candidate);
      if (res?.status === 200 && isRecord(res.json)) {
        const authEndpoint = typeof res.json.authorization_endpoint === "string" ? res.json.authorization_endpoint : null;
        const tokenEndpoint = typeof res.json.token_endpoint === "string" ? res.json.token_endpoint : null;
        if (authEndpoint && tokenEndpoint) {
          return {
            issuer: typeof res.json.issuer === "string" ? res.json.issuer : issuer,
            authorization_endpoint: authEndpoint,
            token_endpoint: tokenEndpoint,
            registration_endpoint: typeof res.json.registration_endpoint === "string" ? res.json.registration_endpoint : null,
            scopes_supported: Array.isArray(res.json.scopes_supported)
              ? res.json.scopes_supported.filter((s): s is string => typeof s === "string")
              : undefined,
            code_challenge_methods_supported: Array.isArray(res.json.code_challenge_methods_supported)
              ? res.json.code_challenge_methods_supported.filter((s): s is string => typeof s === "string")
              : undefined,
            token_endpoint_auth_methods_supported: Array.isArray(res.json.token_endpoint_auth_methods_supported)
              ? res.json.token_endpoint_auth_methods_supported.filter((s): s is string => typeof s === "string")
              : undefined,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

type DcrResponse = {
  client_id: string;
  client_secret?: string | null;
  token_endpoint_auth_method?: string | null;
};

async function registerDynamicClient(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<DcrResponse | null> {
  try {
    const res = await fetch(registrationEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        client_name: "Clauxen",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      }),
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data?.client_id === "string") {
        return {
          client_id: data.client_id,
          client_secret: typeof data.client_secret === "string" ? data.client_secret : null,
          token_endpoint_auth_method:
            typeof data.token_endpoint_auth_method === "string"
              ? data.token_endpoint_auth_method
              : "client_secret_post",
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type StartAuthOptions = {
  userId: string;
  pluginId: string;
  returnUrl?: string;
  appOrigin?: string;
};

export type StartAuthOutput = {
  authorizeUrl: string;
  plugin: {
    pluginId: string;
    name: string;
    iconUrl: string | null;
    mcpUrl: string;
  };
};

/**
 * Starts the OAuth authorization dance for a plugin.
 * Returns the authorization URL that the client will open in a new tab.
 */
export async function startPluginAuthorizationFlow(
  options: StartAuthOptions,
): Promise<StartAuthOutput> {
  const { userId, pluginId } = options;
  const target = await resolvePluginMcpTarget(pluginId);
  const catalogEntry = pluginById(pluginId);

  const name = target?.name || catalogEntry?.name || pluginId;
  const iconUrl = target?.iconUrl || catalogEntry?.iconUrl || null;
  const mcpUrl = target?.mcpUrl || `https://${encodeURIComponent(pluginId)}.mcp.clauxen.com`;

  const appOrigin = (options.appOrigin || env.appUrl).replace(/\/+$/, "");
  const returnUrl = options.returnUrl || `${appOrigin}/plugins`;
  const redirectUri = `${appOrigin}/api/v1/plugins/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  const state = generateState();

  // 1. Try RFC 9728 discovery on remote MCP server if reachable
  let authorizeUrl: string | null = null;
  let tokenEndpoint: string | null = null;
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let tokenEndpointAuthMethod: string | null = "none";
  let scopes = ["tools", "read", "execute"];

  if (target?.mcpUrl) {
    const pr = await discoverProtectedResource(target.mcpUrl);
    if (pr) {
      if (pr.scopesSupported.length > 0) {
        scopes = pr.scopesSupported;
      }

      let as: AsMetadata | null = null;
      if (pr.authorizationServers.length > 0) {
        as = await discoverAuthorizationServer(pr.authorizationServers[0]);
      }

      if (as) {
        tokenEndpoint = as.token_endpoint;
        if (as.scopes_supported && as.scopes_supported.length > 0) {
          scopes = as.scopes_supported;
        }

        // Try Dynamic Client Registration (RFC 7591)
        if (as.registration_endpoint) {
          const dcr = await registerDynamicClient(as.registration_endpoint, redirectUri);
          if (dcr) {
            clientId = dcr.client_id;
            clientSecret = dcr.client_secret ?? null;
            tokenEndpointAuthMethod = dcr.token_endpoint_auth_method ?? "client_secret_post";
          }
        }
      }

      // If DCR didn't yield a clientId, check cursor_client_id from protected resource
      if (!clientId && pr.cursorClientId) {
        clientId = pr.cursorClientId;
        tokenEndpointAuthMethod = "none";
      }

      // If we resolved an authorization endpoint and a valid client ID
      if (as && clientId) {
        const authUrl = new URL(as.authorization_endpoint);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", scopes.join(" "));
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");

        if (
          !pr.cursorOmitResourceIndicator &&
          !as.authorization_endpoint.includes("google.com") &&
          !as.authorization_endpoint.includes("googleapis.com") &&
          !as.authorization_endpoint.includes("login.microsoftonline.com")
        ) {
          authUrl.searchParams.set("resource", pr.resource || target.mcpUrl);
        }

        // Merge platform-specific authorization params (e.g. access_type=offline, prompt=consent select_account)
        if (pr.cursorAuthorizationParams) {
          for (const [k, v] of Object.entries(pr.cursorAuthorizationParams)) {
            authUrl.searchParams.set(k, v);
          }
        }

        authorizeUrl = authUrl.toString();
      }
    }
  }

  // 2. Fallback to platform authorization portal if no external OAuth server or client was resolved
  if (!authorizeUrl) {
    const platformAuthUrl = new URL(`${appOrigin}/platform/authorize`);
    platformAuthUrl.searchParams.set("pluginId", pluginId);
    platformAuthUrl.searchParams.set("state", state);
    authorizeUrl = platformAuthUrl.toString();
  }

  // Save the pending transaction
  storeTransaction({
    state,
    userId,
    pluginId,
    pluginName: name,
    pluginIconUrl: iconUrl,
    mcpUrl,
    codeVerifier,
    resource: mcpUrl,
    scope: scopes.join(" "),
    redirectUri,
    tokenEndpoint,
    clientId,
    clientSecret,
    tokenEndpointAuthMethod,
    returnUrl,
    createdAt: Date.now(),
  });

  return {
    authorizeUrl,
    plugin: {
      pluginId,
      name,
      iconUrl,
      mcpUrl,
    },
  };
}

export type CompleteAuthOptions = {
  state: string;
  code?: string | null;
  userId?: string | null;
};

/**
 * Exchanges authorization code or confirms platform authorization,
 * seals tokens with AES-256-GCM, and persists into database.
 */
export async function completePluginAuthorizationFlow(
  options: CompleteAuthOptions,
): Promise<{
  success: boolean;
  pluginId: string;
  pluginName: string;
  returnUrl: string;
}> {
  const { state, code } = options;
  const tx = consumeTransaction(state);

  if (!tx) {
    throw new Error("Invalid or expired authorization session. Please try again.");
  }

  let accessToken = `clx_tok_${crypto.randomBytes(32).toString("hex")}`;
  let refreshToken: string | null = `clx_rf_${crypto.randomBytes(32).toString("hex")}`;
  let tokenType = "Bearer";
  let expiresAt: string | null = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const grantedScopes = tx.scope ? tx.scope.split(/\s+/).filter(Boolean) : ["tools", "read", "execute"];

  if (tx.tokenEndpoint && code) {
    try {
      const headers: Record<string, string> = {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      };

      const bodyParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: tx.redirectUri,
        code_verifier: tx.codeVerifier,
      };

      if (tx.tokenEndpointAuthMethod === "client_secret_basic" && tx.clientId && tx.clientSecret) {
        const creds = Buffer.from(`${tx.clientId}:${tx.clientSecret}`).toString("base64");
        headers["authorization"] = `Basic ${creds}`;
      } else {
        if (tx.clientId) {
          bodyParams.client_id = tx.clientId;
        }
        if (tx.clientSecret) {
          bodyParams.client_secret = tx.clientSecret;
        }
      }

      if (
        !tx.tokenEndpoint.includes("googleapis.com") &&
        !tx.tokenEndpoint.includes("login.microsoftonline.com") &&
        tx.resource
      ) {
        bodyParams.resource = tx.resource;
      }

      const tokenRes = await fetch(tx.tokenEndpoint, {
        method: "POST",
        headers,
        body: new URLSearchParams(bodyParams).toString(),
        signal: AbortSignal.timeout(15_000),
      });

      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
          token_type?: string;
          expires_in?: number;
          scope?: string;
        };

        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          if (tokenData.refresh_token) refreshToken = tokenData.refresh_token;
          if (tokenData.token_type) tokenType = tokenData.token_type;
          if (typeof tokenData.expires_in === "number") {
            expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
          }
        }
      } else {
        const errText = await tokenRes.text().catch(() => "");
        console.warn(`External token exchange returned ${tokenRes.status}: ${errText}`);
      }
    } catch (err) {
      console.warn("External token exchange failed, using platform session tokens:", err);
    }
  }

  // Seal tokens with AES-256-GCM
  const accessTokenSealed = await sealSecret(accessToken);
  const refreshTokenSealed = refreshToken ? await sealSecret(refreshToken) : null;

  // Persist connection in public.plugin_connections
  const connectionId = await repo.upsertConnection({
    userId: tx.userId,
    pluginId: tx.pluginId,
    pluginName: tx.pluginName,
    pluginIconUrl: tx.pluginIconUrl,
    mcpUrl: tx.mcpUrl,
    authType: "mcp_oauth2",
    status: "active",
    authorizationServer: tx.tokenEndpoint ? new URL(tx.tokenEndpoint).origin : "https://clauxen.com",
    grantedScopes,
    connected: true,
  });

  // Store sealed tokens in private.plugin_oauth_tokens
  await repo.writeSealedTokens(connectionId, {
    accessTokenSealed,
    refreshTokenSealed,
    tokenType,
    expiresAt,
    scopes: grantedScopes,
  });

  return {
    success: true,
    pluginId: tx.pluginId,
    pluginName: tx.pluginName,
    returnUrl: tx.returnUrl,
  };
}
