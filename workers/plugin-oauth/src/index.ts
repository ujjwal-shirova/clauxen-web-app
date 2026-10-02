/**
 * Clauxen Plugin OAuth — Cloudflare Worker.
 *
 * Runs the Model Context Protocol OAuth 2.1 authorization dance on behalf of
 * the Clauxen web app. Clicking "Add to Clauxen" asks this worker to start an
 * authorization; the worker does RFC 9728 / RFC 8414 discovery, registers an
 * OAuth client, and returns the provider's authorization URL, which the app
 * opens in a new tab.
 *
 * The provider redirects back to GET /v0/oauth/callback, where the worker
 * exchanges the code for tokens (PKCE + RFC 8707 resource), seals them with
 * AES-256-GCM, and writes them to Supabase through the service-role-only
 * plugin_oauth_* RPCs.
 *
 * Routes
 *   GET  /.well-known/oauth-client   Client ID Metadata Document (CIMD)
 *   POST /v0/oauth/start             begin an authorization   (internal token)
 *   GET  /v0/oauth/callback          provider redirect target
 *   POST /v0/oauth/refresh           rotate an expired token   (internal token)
 *   GET  /v0/health                  liveness
 */

import {
  buildAuthorizeUrl,
  deriveCodeChallenge,
  discoverAuthorizationServer,
  discoverProtectedResource,
  exchangeAuthorizationCode,
  generateCodeVerifier,
  generateState,
  McpOAuthError,
  refreshAccessToken,
  registerClient,
  requestedScopes,
  type AsMetadata,
  type RegisteredClient,
} from "./oauth";
import {
  completeConnection,
  readRefreshPayload,
  rotateTokens,
  SupabaseError,
} from "./supabase";
import {
  connectedScript,
  errorPage,
  escapeHtml,
  htmlPage,
} from "./pages";
import {
  deriveSealKey,
  sealSecret,
  unsealSecret,
} from "../../../src/shared/lib/plugin-token-seal";

export interface Env {
  OAUTH_STATE: KVNamespace;
  OAUTH_CLIENTS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_TOKEN: string;
  TOKEN_SEAL_KEY: string;
  WORKER_ORIGIN: string;
  APP_ORIGIN: string;
}

type PendingAuth = {
  userId: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  mcpUrl: string;
  codeVerifier: string;
  resource: string;
  scope: string;
  redirectUri: string;
  issuer: string;
  returnUrl: string;
};

const STATE_TTL_SECONDS = 900;
const CLIENT_CACHE_TTL_SECONDS = 86_400;

// ─── helpers ────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function errorJson(message: string, code: string, status = 400): Response {
  return json({ error: { message, code } }, status);
}

function isInternalRequest(request: Request, env: Env): boolean {
  const token = request.headers.get("x-clauxen-internal-token") ?? "";
  return (
    token.length > 0 &&
    env.INTERNAL_TOKEN.length > 0 &&
    token === env.INTERNAL_TOKEN
  );
}

function baseOrigin(value: string): string {
  return value.split(",")[0]?.trim().replace(/\/+$/, "") ?? "";
}

function redirectUriFor(env: Env): string {
  return `${baseOrigin(env.WORKER_ORIGIN)}/v0/oauth/callback`;
}

function clientMetadataUrlFor(env: Env): string {
  return `${baseOrigin(env.WORKER_ORIGIN)}/.well-known/oauth-client`;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await request.text());
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function requireString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function seal(env: Env, value: string): Promise<string> {
  return sealSecret(value, await deriveSealKey(env.TOKEN_SEAL_KEY));
}

async function unseal(env: Env, value: string): Promise<string | null> {
  return unsealSecret(value, await deriveSealKey(env.TOKEN_SEAL_KEY));
}

async function loadClient(
  env: Env,
  metadata: AsMetadata,
  scope: string,
): Promise<RegisteredClient> {
  const cacheKey = `client:${metadata.issuer}`;
  const cached = (await env.OAUTH_CLIENTS.get(cacheKey, "json")) as
    | RegisteredClient
    | null;
  if (cached?.clientId) return cached;

  const client = await registerClient(
    metadata,
    redirectUriFor(env),
    scope,
    clientMetadataUrlFor(env),
  );
  await env.OAUTH_CLIENTS.put(cacheKey, JSON.stringify(client), {
    expirationTtl: CLIENT_CACHE_TTL_SECONDS,
  });
  return client;
}

/** Only ever return the user to our own app origins. */
function safeReturnUrl(raw: string, appOrigin: string): string {
  try {
    const parsed = new URL(raw);
    const allowed = appOrigin
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (allowed.includes(parsed.origin)) return parsed.toString();
  } catch {
    /* fall through to default */
  }
  return `${baseOrigin(appOrigin)}/plugins`;
}

// ─── POST /v0/oauth/start ───────────────────────────────────────────────────

async function handleStart(request: Request, env: Env): Promise<Response> {
  if (!isInternalRequest(request, env)) {
    return errorJson("Unauthorized.", "unauthorized", 401);
  }

  const body = await readJsonBody(request);
  const userId = requireString(body, "userId");
  const pluginId = requireString(body, "pluginId");
  const mcpUrl = requireString(body, "mcpUrl");
  const returnUrl =
    requireString(body, "returnUrl") ?? `${baseOrigin(env.APP_ORIGIN)}/plugins`;

  if (!userId || !pluginId || !mcpUrl) {
    return errorJson("userId, pluginId and mcpUrl are required.", "invalid_request");
  }

  try {
    const parsed = new URL(mcpUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new McpOAuthError("mcpUrl must be an http(s) URL.", "invalid_request" as never);
    }
  } catch {
    return errorJson("mcpUrl must be an http(s) URL.", "invalid_request");
  }

  try {
    const resource = await discoverProtectedResource(mcpUrl);
    const issuer = resource.authorizationServers[0];
    if (!issuer) {
      return errorJson(
        "This plugin does not advertise an OAuth authorization server.",
        "unsupported_server",
        422,
      );
    }

    const metadata = await discoverAuthorizationServer(issuer);
    const scope = requestedScopes(metadata).join(" ");
    const client = await loadClient(env, metadata, scope);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const state = generateState();
    const redirectUri = redirectUriFor(env);

    const authorizeUrl = buildAuthorizeUrl({
      metadata,
      client,
      redirectUri,
      scope,
      state,
      codeChallenge,
      resource: mcpUrl,
    });

    const pending: PendingAuth = {
      userId,
      pluginId,
      pluginName: requireString(body, "pluginName") ?? pluginId,
      pluginIconUrl: requireString(body, "pluginIconUrl"),
      mcpUrl,
      codeVerifier,
      resource: mcpUrl,
      scope,
      redirectUri,
      issuer: metadata.issuer,
      returnUrl,
    };
    await env.OAUTH_STATE.put(state, JSON.stringify(pending), {
      expirationTtl: STATE_TTL_SECONDS,
    });

    return json({ data: { authorizeUrl, state } });
  } catch (error) {
    return errorJson(describeError(error), "start_failed", 502);
  }
}

// ─── GET /v0/oauth/callback ─────────────────────────────────────────────────

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (!state) {
    return errorPage("The authorization response was missing its state.");
  }

  const stored = (await env.OAUTH_STATE.get(state, "json")) as PendingAuth | null;
  await env.OAUTH_STATE.delete(state);
  if (!stored) {
    return errorPage(
      "This authorization link has expired or was already used. Please try again.",
    );
  }

  if (providerError) {
    return errorPage(
      `The provider declined the connection (${escapeHtml(providerError)}). No access was granted.`,
    );
  }
  if (!code) {
    return errorPage("The provider did not return an authorization code.");
  }

  try {
    const metadata = await discoverAuthorizationServer(stored.issuer);
    const client = await loadClient(env, metadata, stored.scope);

    const tokens = await exchangeAuthorizationCode({
      metadata,
      client,
      code,
      redirectUri: stored.redirectUri,
      codeVerifier: stored.codeVerifier,
      resource: stored.resource,
      scope: stored.scope,
    });

    const scopes = tokens.scopes.length
      ? tokens.scopes
      : stored.scope.split(" ").filter(Boolean);

    await completeConnection(env, {
      userId: stored.userId,
      pluginId: stored.pluginId,
      pluginName: stored.pluginName,
      pluginIconUrl: stored.pluginIconUrl,
      mcpUrl: stored.mcpUrl,
      authType: "mcp_oauth2",
      status: "active",
      authorizationServer: stored.issuer,
      grantedScopes: scopes,
      providerAccountId: null,
      accessTokenSealed: await seal(env, tokens.accessToken),
      refreshTokenSealed: tokens.refreshToken
        ? await seal(env, tokens.refreshToken)
        : null,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt,
      tokenScopes: scopes,
    });

    return htmlPage(
      `${escapeHtml(stored.pluginName)} connected`,
      "Clauxen can now use this plugin&rsquo;s tools in chat. You can close this tab.",
      connectedScript(stored.pluginId),
    );
  } catch (error) {
    return errorPage(escapeHtml(describeError(error)));
  }
}

// ─── POST /v0/oauth/refresh ─────────────────────────────────────────────────

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  if (!isInternalRequest(request, env)) {
    return errorJson("Unauthorized.", "unauthorized", 401);
  }

  const body = await readJsonBody(request);
  const connectionId = requireString(body, "connectionId");
  if (!connectionId) {
    return errorJson("connectionId is required.", "invalid_request");
  }

  try {
    const payload = await readRefreshPayload(env, connectionId);
    if (!payload) return errorJson("Connection not found.", "not_found", 404);
    if (!payload.refreshTokenSealed) {
      return errorJson(
        "This connection has no refresh token; the user must reconnect.",
        "reauthorization_required",
        409,
      );
    }

    const refreshToken = await unseal(env, payload.refreshTokenSealed);
    if (!refreshToken) {
      return errorJson(
        "Stored credentials could not be read; the user must reconnect.",
        "reauthorization_required",
        409,
      );
    }

    const issuer =
      payload.authorizationServer ?? new URL(payload.mcpUrl).origin;
    const metadata = await discoverAuthorizationServer(issuer);
    const scope = payload.grantedScopes.join(" ");
    const client = await loadClient(env, metadata, scope);

    const tokens = await refreshAccessToken({
      metadata,
      client,
      refreshToken,
      resource: payload.mcpUrl,
      scope,
    });

    await rotateTokens(env, {
      connectionId,
      accessTokenSealed: await seal(env, tokens.accessToken),
      refreshTokenSealed: tokens.refreshToken
        ? await seal(env, tokens.refreshToken)
        : null,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt,
      tokenScopes: tokens.scopes.length ? tokens.scopes : payload.grantedScopes,
    });

    return json({ data: { ok: true, expiresAt: tokens.expiresAt } });
  } catch (error) {
    return errorJson(describeError(error), "refresh_failed", 502);
  }
}

function describeError(error: unknown): string {
  if (error instanceof McpOAuthError || error instanceof SupabaseError) {
    return error.message;
  }
  return "Something went wrong while connecting this plugin.";
}

// ─── router ─────────────────────────────────────────────────────────────────

function clientMetadataDocument(env: Env): Response {
  return json({
    client_id: clientMetadataUrlFor(env),
    client_name: "Clauxen",
    client_uri: baseOrigin(env.APP_ORIGIN),
    redirect_uris: [redirectUriFor(env)],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (request.method === "GET" && path === "/v0/health") {
      return json({ ok: true });
    }
    if (request.method === "GET" && path === "/.well-known/oauth-client") {
      return clientMetadataDocument(env);
    }
    if (request.method === "POST" && path === "/v0/oauth/start") {
      return handleStart(request, env);
    }
    if (request.method === "GET" && path === "/v0/oauth/callback") {
      return handleCallback(request, env);
    }
    if (request.method === "POST" && path === "/v0/oauth/refresh") {
      return handleRefresh(request, env);
    }

    return errorJson("Not found.", "not_found", 404);
  },
};
