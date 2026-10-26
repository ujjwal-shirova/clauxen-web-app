import { env } from "@/server/config/env";
import { sealSecret, unsealSecret } from "@/server/plugins/token-crypto";
import {
  resolveConnector,
  type ConnectorSpec,
} from "@/server/plugins/connector-registry";
import {
  fetchAccountLabel,
  providerConfig,
  providerCredentials,
  providerForIssuer,
  revokeAtProvider,
  type OAuthProviderId,
} from "@/server/plugins/oauth-providers";
import {
  discoverAuthorizationServer,
  discoverProtectedResource,
  obtainDynamicClient,
  PluginOAuthError,
  probeMcpServer,
} from "@/server/plugins/oauth-discovery";
import { discoverMcpCapabilities, type McpDiscoveredTool } from "@/server/plugins/mcp-client";
import { restToolset, type RestToolsetId, type ToolRisk } from "@/server/plugins/rest-toolsets";
import {
  getAccessToken,
  readPlainTokens,
  requestToken,
  type ClientAuth,
} from "@/server/plugins/token-manager";
import * as repo from "@/server/repositories/plugin-connections.repository";
import type { PluginConnectionRow } from "@/server/repositories/plugin-connections.repository";

/**
 * Plugin authorization. Every connection is granted on the provider's own
 * consent screen and backed by tokens the provider issued — Clauxen never
 * hosts its own "authorize" page or invents credentials.
 */

const STATE_TTL_SECONDS = 600;
export const CALLBACK_PATH = "/api/v1/plugins/callback";
export const CLIENT_METADATA_PATH = "/api/v1/plugins/oauth-client";

type PendingAuthorization = {
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  connectorKind: "mcp" | "rest";
  mcpUrl: string | null;
  toolset: RestToolsetId | null;
  provider: OAuthProviderId | null;
  issuer: string;
  tokenEndpoint: string;
  revocationEndpoint: string | null;
  clientId: string;
  clientSecret: string | null;
  tokenAuthMethod: ClientAuth["tokenAuthMethod"];
  codeVerifier: string;
  redirectUri: string;
  resource: string | null;
  scopes: string[];
};

export type StartResult =
  | { type: "redirect"; url: string }
  | { type: "connected"; pluginId: string; pluginName: string };

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function hashState(state: string): Promise<string> {
  return Array.from(await sha256(state), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function uniqueScopes(scopes: string[]): string[] {
  return [...new Set(scopes.filter(Boolean))];
}

export function appOriginFrom(requestOrigin: string | null): string {
  return (requestOrigin || env.appUrl).replace(/\/+$/, "");
}

// ─── start ──────────────────────────────────────────────────────────────────

type AuthorizationPlan = Omit<
  PendingAuthorization,
  "pluginId" | "pluginName" | "pluginIconUrl" | "codeVerifier" | "redirectUri"
> & {
  authorizationEndpoint: string;
  sendResource: boolean;
  extraParams: Record<string, string>;
  scopeSeparator: string;
};

function providerPlan(
  provider: OAuthProviderId,
  scopes: string[],
): Pick<AuthorizationPlan, "clientId" | "clientSecret" | "tokenAuthMethod" | "extraParams" | "scopeSeparator" | "scopes"> {
  const credentials = providerCredentials(provider);
  if (!credentials) {
    throw new PluginOAuthError(
      `${providerConfig(provider).label} sign-in is not configured for this workspace yet.`,
      "registration_unavailable",
    );
  }
  const config = providerConfig(provider);
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    tokenAuthMethod: config.tokenAuthMethod,
    extraParams: config.authorizationParams,
    scopeSeparator: config.scopeSeparator,
    scopes: uniqueScopes([...scopes, ...config.identityScopes]),
  };
}

async function planRest(
  spec: Extract<ConnectorSpec, { kind: "rest" }>,
): Promise<AuthorizationPlan> {
  const config = providerConfig(spec.provider);
  return {
    connectorKind: "rest",
    mcpUrl: null,
    toolset: spec.toolset,
    provider: spec.provider,
    issuer: new URL(config.authorizationEndpoint).origin,
    authorizationEndpoint: config.authorizationEndpoint,
    tokenEndpoint: config.tokenEndpoint,
    revocationEndpoint: null,
    resource: null,
    sendResource: false,
    ...providerPlan(spec.provider, spec.scopes),
  };
}

async function planMcp(
  spec: Extract<ConnectorSpec, { kind: "mcp" }>,
  resourceMetadataUrl: string | null,
  redirectUri: string,
  clientMetadataUrl: string,
): Promise<AuthorizationPlan> {
  const resource = await discoverProtectedResource(spec.mcpUrl, resourceMetadataUrl);
  const server = await discoverAuthorizationServer(resource.authorizationServers[0]);
  const provider =
    spec.provider ??
    providerForIssuer(server.issuer) ??
    providerForIssuer(server.authorizationEndpoint);

  const scopes = resource.scopesSupported.length
    ? resource.scopesSupported
    : spec.fallbackScopes.length
      ? spec.fallbackScopes
      : server.scopesSupported.filter((scope) => scope !== "offline_access");

  const common = {
    connectorKind: "mcp" as const,
    mcpUrl: spec.mcpUrl,
    toolset: null,
    issuer: server.issuer,
    authorizationEndpoint: server.authorizationEndpoint,
    tokenEndpoint: server.tokenEndpoint,
    revocationEndpoint: server.revocationEndpoint,
    resource: resource.resource,
  };

  if (provider) {
    return {
      ...common,
      provider,
      sendResource: providerConfig(provider).sendsResourceIndicator,
      ...providerPlan(provider, scopes),
    };
  }

  const client = await obtainDynamicClient(server, redirectUri, clientMetadataUrl);
  const wantsOffline =
    server.scopesSupported.includes("offline_access") && !scopes.includes("offline_access");
  return {
    ...common,
    provider: null,
    sendResource: true,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    tokenAuthMethod: client.tokenAuthMethod,
    extraParams: {},
    scopeSeparator: " ",
    scopes: uniqueScopes(wantsOffline ? [...scopes, "offline_access"] : scopes),
  };
}

function providerMcpPlan(
  spec: Extract<ConnectorSpec, { kind: "mcp" }>,
  provider: OAuthProviderId,
): AuthorizationPlan {
  const config = providerConfig(provider);
  return {
    connectorKind: "mcp",
    mcpUrl: spec.mcpUrl,
    toolset: null,
    provider,
    issuer: new URL(config.authorizationEndpoint).origin,
    authorizationEndpoint: config.authorizationEndpoint,
    tokenEndpoint: config.tokenEndpoint,
    revocationEndpoint: null,
    resource: spec.mcpUrl,
    sendResource: config.sendsResourceIndicator,
    ...providerPlan(provider, spec.fallbackScopes),
  };
}

/**
 * Begin connecting a plugin. Returns the provider's authorization URL, or
 * connects immediately when the plugin's MCP server needs no authorization.
 */
export async function startPluginConnection(input: {
  userId: string;
  pluginId: string;
  appOrigin: string;
}): Promise<StartResult> {
  const spec = resolveConnector(input.pluginId);
  if (!spec) {
    throw new PluginOAuthError(
      "This plugin only runs locally and cannot be connected to Clauxen.",
      "discovery_failed",
    );
  }

  const redirectUri = `${input.appOrigin}${CALLBACK_PATH}`;
  const clientMetadataUrl = `${input.appOrigin}${CLIENT_METADATA_PATH}`;

  let plan: AuthorizationPlan;
  if (spec.kind === "rest") {
    plan = await planRest(spec);
  } else if (spec.provider) {
    // Provider-backed servers always require that provider's OAuth. Prefer
    // the server's published metadata, else the provider's known endpoints.
    plan = await planMcp(spec, null, redirectUri, clientMetadataUrl).catch(() =>
      providerMcpPlan(spec, spec.provider!),
    );
  } else {
    const probe = await probeMcpServer(spec.mcpUrl);
    if (probe.kind === "public") {
      const connectionId = await repo.upsertActiveConnection({
        userId: input.userId,
        pluginId: spec.pluginId,
        pluginName: spec.name,
        pluginIconUrl: spec.iconUrl,
        connectorKind: "mcp",
        mcpUrl: spec.mcpUrl,
        authType: "none",
        authorizationServer: null,
        accountLabel: null,
        grantedScopes: [],
      });
      await syncCapabilities(connectionId, input.userId).catch(() => null);
      return { type: "connected", pluginId: spec.pluginId, pluginName: spec.name };
    }
    plan = await planMcp(spec, probe.resourceMetadataUrl, redirectUri, clientMetadataUrl);
  }

  const state = randomToken(32);
  const codeVerifier = randomToken(48);
  const codeChallenge = base64Url(await sha256(codeVerifier));

  const pending: PendingAuthorization = {
    pluginId: spec.pluginId,
    pluginName: spec.name,
    pluginIconUrl: spec.iconUrl,
    connectorKind: plan.connectorKind,
    mcpUrl: plan.mcpUrl,
    toolset: plan.toolset,
    provider: plan.provider,
    issuer: plan.issuer,
    tokenEndpoint: plan.tokenEndpoint,
    revocationEndpoint: plan.revocationEndpoint,
    clientId: plan.clientId,
    clientSecret: plan.clientSecret,
    tokenAuthMethod: plan.tokenAuthMethod,
    codeVerifier,
    redirectUri,
    resource: plan.sendResource ? plan.resource : null,
    scopes: plan.scopes,
  };

  await repo.saveOAuthState({
    stateHash: await hashState(state),
    userId: input.userId,
    pluginId: spec.pluginId,
    payloadSealed: await sealSecret(JSON.stringify(pending)),
    ttlSeconds: STATE_TTL_SECONDS,
  });

  const url = new URL(plan.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", plan.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (plan.scopes.length > 0) {
    url.searchParams.set("scope", plan.scopes.join(plan.scopeSeparator));
  }
  if (pending.resource) url.searchParams.set("resource", pending.resource);
  for (const [key, value] of Object.entries(plan.extraParams)) {
    url.searchParams.set(key, value);
  }
  return { type: "redirect", url: url.toString() };
}

// ─── complete ───────────────────────────────────────────────────────────────

export async function completePluginConnection(input: {
  state: string;
  code: string;
  sessionUserId: string | null;
}): Promise<{ pluginId: string; pluginName: string }> {
  const row = await repo.consumeOAuthState(await hashState(input.state));
  if (!row) {
    throw new PluginOAuthError(
      "This authorization link expired or was already used. Start the connection again.",
      "token_exchange_failed",
    );
  }
  // The callback must land in the same signed-in browser that started it.
  if (!input.sessionUserId || input.sessionUserId !== row.user_id) {
    throw new PluginOAuthError(
      "Sign in to Clauxen with the account that started this connection, then try again.",
      "token_exchange_failed",
    );
  }

  const payload = await unsealSecret(row.payload_sealed);
  if (!payload) {
    throw new PluginOAuthError("Authorization data could not be read.", "token_exchange_failed");
  }
  const pending = JSON.parse(payload) as PendingAuthorization;

  let tokens;
  try {
    tokens = await requestToken(
      pending.tokenEndpoint,
      {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.codeVerifier,
        ...(pending.resource ? { resource: pending.resource } : {}),
      },
      {
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        tokenAuthMethod: pending.tokenAuthMethod,
      },
    );
  } catch (error) {
    throw new PluginOAuthError(
      error instanceof Error ? error.message : "Token exchange failed.",
      "token_exchange_failed",
    );
  }

  const accountLabel = pending.provider
    ? await fetchAccountLabel(pending.provider, tokens.accessToken).catch(() => null)
    : null;

  const connectionId = await repo.upsertActiveConnection({
    userId: row.user_id,
    pluginId: pending.pluginId,
    pluginName: pending.pluginName,
    pluginIconUrl: pending.pluginIconUrl,
    connectorKind: pending.connectorKind,
    mcpUrl: pending.mcpUrl,
    authType: pending.connectorKind === "mcp" ? "mcp_oauth2" : "oauth2",
    authorizationServer: pending.issuer,
    accountLabel,
    grantedScopes: tokens.scopes.length ? tokens.scopes : pending.scopes,
  });

  await repo.writeSealedTokens(connectionId, {
    accessTokenSealed: await sealSecret(tokens.accessToken),
    refreshTokenSealed: tokens.refreshToken ? await sealSecret(tokens.refreshToken) : null,
    // Pre-registered provider secrets stay in the environment only.
    clientSecretSealed:
      !pending.provider && pending.clientSecret ? await sealSecret(pending.clientSecret) : null,
    tokenType: tokens.tokenType,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes.length ? tokens.scopes : pending.scopes,
    oauthMeta: {
      provider: pending.provider,
      issuer: pending.issuer,
      tokenEndpoint: pending.tokenEndpoint,
      revocationEndpoint: pending.revocationEndpoint,
      clientId: pending.provider ? null : pending.clientId,
      tokenAuthMethod: pending.tokenAuthMethod,
      resource: pending.resource,
      toolset: pending.toolset,
    },
  });

  await syncCapabilities(connectionId, row.user_id).catch(() => null);
  return { pluginId: pending.pluginId, pluginName: pending.pluginName };
}

// ─── capabilities ───────────────────────────────────────────────────────────

const READ_NAME = /^(get|list|search|read|fetch|find|query|describe|view|show|lookup|count|check|summari[sz]e|retrieve|browse|explain|analy[sz]e)[_-]?/i;
const DESTRUCTIVE_NAME = /(delete|remove|destroy|drop|purge|revoke|erase|trash|wipe|terminate|uninstall)/i;

export function classifyMcpTool(tool: McpDiscoveredTool): ToolRisk {
  if (tool.annotations.destructiveHint === true) return "destructive";
  if (tool.annotations.readOnlyHint === true) return "read";
  if (DESTRUCTIVE_NAME.test(tool.name)) return "destructive";
  if (READ_NAME.test(tool.name)) return "read";
  return "write";
}

/** Rediscover a connection's tools, resources, and prompts. */
export async function syncCapabilities(connectionId: string, userId: string): Promise<number> {
  const connection = await repo.getConnectionForUser(connectionId, userId);
  if (!connection) throw new Error("Connection not found.");

  if (connection.connector_kind === "rest") {
    const tokens = await repo.readSealedTokens(connection.id);
    const toolset = tokens?.oauth_meta?.toolset as RestToolsetId | undefined;
    if (!toolset) return 0;
    const tools = restToolset(toolset);
    await repo.replaceConnectionTools(
      connection.id,
      tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        risk: tool.risk,
      })),
    );
    await repo.replaceCapabilities(connection.id, []);
    return tools.length;
  }

  if (!connection.mcp_url) return 0;
  const token = await getAccessToken(connection);
  if (!token.ok) throw new Error("Reconnect this plugin to refresh its tools.");
  const discovered = await discoverMcpCapabilities(connection.mcp_url, token.accessToken);
  if (!discovered.ok) {
    if (discovered.code === "unauthorized" || discovered.code === "forbidden") {
      await repo.setConnectionStatus(connection.id, "reauthorization_required", discovered.code);
    }
    throw new Error(discovered.message);
  }

  await repo.replaceConnectionTools(
    connection.id,
    discovered.value.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      risk: classifyMcpTool(tool),
    })),
  );
  await repo.replaceCapabilities(connection.id, [
    ...discovered.value.resources.map((item) => ({ kind: "resource" as const, ...item })),
    ...discovered.value.prompts.map((item) => ({ kind: "prompt" as const, ...item })),
  ]);
  return discovered.value.tools.length;
}

// ─── disconnect ─────────────────────────────────────────────────────────────

async function revokeGeneric(
  endpoint: string,
  token: string,
  clientId: string,
  clientSecret: string | null,
): Promise<void> {
  const body = new URLSearchParams({ token, client_id: clientId });
  if (clientSecret) body.set("client_secret", clientSecret);
  await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(8_000),
  });
}

/** Revoke at the provider (best effort), then delete every stored secret. */
export async function disconnectPlugin(
  connection: PluginConnectionRow,
  userId: string,
): Promise<boolean> {
  const plain = await readPlainTokens(connection.id).catch(() => null);
  if (plain) {
    const token = plain.refreshToken ?? plain.accessToken;
    const provider = (plain.meta.provider ?? null) as OAuthProviderId | null;
    try {
      if (token && provider) {
        await revokeAtProvider(provider, token);
      } else if (token && plain.meta.revocationEndpoint && plain.meta.clientId) {
        await revokeGeneric(
          plain.meta.revocationEndpoint,
          token,
          plain.meta.clientId,
          plain.clientSecretSealed ? await unsealSecret(plain.clientSecretSealed) : null,
        );
      }
    } catch {
      // Local deletion below still removes Clauxen's access.
    }
  }
  return repo.revokeConnection(connection.id, userId);
}
