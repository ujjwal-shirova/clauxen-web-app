import type { Sql } from "postgres";
import {
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
import { WorkerMcpClient, type McpHttpTool, type McpPrompt } from "./mcp-client";
import { textArray } from "./pg";

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

export async function mcpConnectorKey(pluginId: string): Promise<string> {
  const digest = await sha256(`clauxen-mcp-plugin:${pluginId}`);
  return `mcp-${digest.slice(0, 16)}`;
}

function sanitizeToolName(name: string, used: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base || !/^[a-z]/.test(base)) base = `t_${base || "tool"}`;
  // Keep room for mcp__<connectorKey>__ prefix under the 64-char tool name cap.
  base = base.slice(0, 36);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 34)}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as Record<string, unknown>;
    return payload && typeof payload === "object" ? payload : {};
  } finally {
    clearTimeout(timer);
  }
}

function firstHttps(
  values: unknown,
  fallback?: string | null,
): string | null {
  const candidates = [
    ...(Array.isArray(values) ? values : values ? [values] : []),
    fallback,
  ];
  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:") return parsed.toString();
    } catch {
      continue;
    }
  }
  return null;
}

function resourceMetadataCandidates(
  mcpUrl: string,
  advertised: string | null,
): string[] {
  const resource = new URL(mcpUrl);
  const out: string[] = [];
  if (advertised) out.push(advertised);
  out.push(`${resource.origin}/.well-known/oauth-protected-resource`);
  const path = resource.pathname.replace(/\/+$/, "");
  if (path && path !== "/") {
    out.push(
      `${resource.origin}/.well-known/oauth-protected-resource${path}`,
    );
  }
  return [...new Set(out)];
}

async function discoverAuthorization(
  mcpUrl: string,
  advertisedMetadataUrl: string | null,
): Promise<{
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string | null;
  revocationEndpoint: string | null;
  scopes: string[];
  resource: string;
  clientIdMetadataDocumentSupported: boolean;
}> {
  let protectedResource: Record<string, unknown> = {};
  for (const candidate of resourceMetadataCandidates(
    mcpUrl,
    advertisedMetadataUrl,
  )) {
    try {
      protectedResource = await fetchJson(candidate);
      if (protectedResource) break;
    } catch {
      continue;
    }
  }
  const resource =
    firstHttps(protectedResource.resource, mcpUrl) ?? mcpUrl;
  const authorizationServers = protectedResource.authorization_servers;
  const issuer =
    firstHttps(authorizationServers) ??
    firstHttps(protectedResource.authorization_server) ??
    new URL(mcpUrl).origin;
  const issuerUrl = new URL(issuer);
  const asMetadataCandidates = [
    `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname === "/" ? "" : issuerUrl.pathname.replace(/\/+$/, "")}`,
    `${issuerUrl.origin}/.well-known/oauth-authorization-server`,
    `${issuerUrl.origin}/.well-known/openid-configuration`,
    `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
  ];
  let asMetadata: Record<string, unknown> = {};
  for (const candidate of [...new Set(asMetadataCandidates)]) {
    try {
      asMetadata = await fetchJson(candidate);
      if (asMetadata.authorization_endpoint && asMetadata.token_endpoint) {
        break;
      }
    } catch {
      continue;
    }
  }
  const authorizationEndpoint = firstHttps(asMetadata.authorization_endpoint);
  const tokenEndpoint = firstHttps(asMetadata.token_endpoint);
  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new HttpError(
      "This plugin's identity provider is missing OAuth endpoints.",
      409,
      "mcp_oauth_undiscoverable",
    );
  }
  const scopes = Array.isArray(protectedResource.scopes_supported)
    ? (protectedResource.scopes_supported as unknown[]).filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : Array.isArray(asMetadata.scopes_supported)
      ? (asMetadata.scopes_supported as unknown[]).filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
  return {
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint: firstHttps(asMetadata.registration_endpoint),
    revocationEndpoint: firstHttps(asMetadata.revocation_endpoint),
    scopes: scopes.slice(0, 20),
    resource,
    clientIdMetadataDocumentSupported:
      asMetadata.client_id_metadata_document_supported === true,
  };
}

/**
 * Self-hosted Client ID Metadata Document URL for this install, derived from
 * the caller's return URL origin. Only HTTPS public origins qualify — the
 * authorization server must fetch this document, so localhost always falls
 * back to Dynamic Client Registration.
 */
function clientMetadataUrlFor(
  returnUrl: string,
  connectorKey: string,
): string | null {
  try {
    const origin = new URL(returnUrl).origin;
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "[::1]" ||
      host.endsWith(".local") ||
      host.endsWith(".localhost")
    ) {
      return null;
    }
    return `${origin}/api/oauth/client-metadata/${encodeURIComponent(connectorKey)}`;
  } catch {
    return null;
  }
}

async function registerOAuthClient(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<{ clientId: string; clientSecret: string | null; authMethod: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(registrationEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_name: "Clauxen",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || typeof payload.client_id !== "string") {
      throw new HttpError(
        "This plugin does not allow Clauxen to register as an OAuth client.",
        409,
        "mcp_oauth_registration_failed",
      );
    }
    const authMethod =
      typeof payload.token_endpoint_auth_method === "string"
        ? payload.token_endpoint_auth_method
        : payload.client_secret
          ? "client_secret_post"
          : "none";
    return {
      clientId: payload.client_id,
      clientSecret:
        typeof payload.client_secret === "string" ? payload.client_secret : null,
      authMethod: ["none", "client_secret_post", "client_secret_basic"].includes(
        authMethod,
      )
        ? authMethod
        : payload.client_secret
          ? "client_secret_post"
          : "none",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function syncMcpTools(
  sql: Sql,
  input: {
    connectorId: string;
    installationId: string;
    mcpUrl: string;
    accessToken?: string | null;
  },
): Promise<{ tools: number; skills: number }> {
  const client = new WorkerMcpClient(input.mcpUrl, input.accessToken);
  try {
    const [tools, prompts] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
    ]);
    await writeMcpTools(sql, input.connectorId, tools, prompts);
    await sql`
      update public.connector_installations
      set settings = coalesce(settings, '{}'::jsonb) || ${sql.json({
        mcpSkills: prompts.slice(0, 50).map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
        })),
        mcpToolCount: tools.length,
        lastMcpSyncAt: new Date().toISOString(),
      })}::jsonb,
          last_synced_at = now(),
          updated_at = now()
      where id = ${input.installationId}::uuid
    `;
    return { tools: tools.length, skills: prompts.length };
  } finally {
    await client.close();
  }
}

async function writeMcpTools(
  sql: Sql,
  connectorId: string,
  tools: McpHttpTool[],
  prompts: McpPrompt[] = [],
): Promise<void> {
  const used = new Set<string>();
  await sql.begin(async (tx) => {
    for (const tool of tools.slice(0, 200)) {
      const name = sanitizeToolName(tool.name, used);
      const title = tool.name.slice(0, 160);
      const description = tool.description.slice(0, 2000);
      const risk =
        /delete|destroy|drop|revoke|wipe|remove_all/i.test(
          `${tool.name} ${tool.description}`,
        )
          ? "sensitive"
          : "read";
      await tx`
        insert into public.connector_tools (
          connector_id, name, title, description, input_schema,
          risk_level, requires_confirmation, is_enabled, metadata
        ) values (
          ${connectorId}::uuid, ${name}, ${title}, ${description},
          ${tx.json(jsonValue(tool.inputSchema))},
          ${risk}, ${risk !== "read"}, true,
          ${tx.json({ mcpName: tool.name, kind: "tool" })}
        )
        on conflict (connector_id, name) do update set
          title = excluded.title,
          description = excluded.description,
          input_schema = excluded.input_schema,
          risk_level = excluded.risk_level,
          requires_confirmation = excluded.requires_confirmation,
          is_enabled = true,
          metadata = excluded.metadata,
          updated_at = now()
      `;
    }
    for (const prompt of prompts.slice(0, 50)) {
      const name = sanitizeToolName(`skill ${prompt.name}`, used);
      const properties: Record<string, JsonValue> = {};
      const required: string[] = [];
      for (const argument of prompt.arguments ?? []) {
        const key = argument.name.slice(0, 64);
        if (!key) continue;
        properties[key] = {
          type: "string",
          description: argument.description || key,
        };
        if (argument.required) required.push(key);
      }
      await tx`
        insert into public.connector_tools (
          connector_id, name, title, description, input_schema,
          risk_level, requires_confirmation, is_enabled, metadata
        ) values (
          ${connectorId}::uuid, ${name}, ${prompt.name.slice(0, 160)},
          ${prompt.description.slice(0, 2000)},
          ${tx.json({
            type: "object",
            properties,
            required,
            additionalProperties: false,
          })},
          'read', false, true,
          ${tx.json({ mcpName: prompt.name, kind: "skill" })}
        )
        on conflict (connector_id, name) do update set
          title = excluded.title,
          description = excluded.description,
          input_schema = excluded.input_schema,
          risk_level = 'read',
          requires_confirmation = false,
          is_enabled = true,
          metadata = excluded.metadata,
          updated_at = now()
      `;
    }
    if (used.size > 0) {
      const names = [...used];
      await tx`
        update public.connector_tools
        set is_enabled = false, updated_at = now()
        where connector_id = ${connectorId}::uuid
          and not (name = any(${textArray(tx, names)}))
      `;
    }
  });
}

async function upsertMcpCatalog(
  sql: Sql,
  input: {
    connectorKey: string;
    pluginId: string;
    displayName: string;
    mcpUrl: string;
    logoUrl: string | null;
    authType: "none" | "mcp_oauth2";
  },
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into public.connector_catalog (
      key, name, provider, auth_type, protocol, mcp_url, scopes, status, metadata
    ) values (
      ${input.connectorKey}, ${input.displayName}, ${new URL(input.mcpUrl).hostname},
      ${input.authType}, 'mcp', ${input.mcpUrl}, '{}'::text[], 'active',
      ${sql.json({
        pluginId: input.pluginId,
        mcpUrl: input.mcpUrl,
        logoUrl: input.logoUrl,
      })}
    )
    on conflict (key) do update set
      name = excluded.name,
      provider = excluded.provider,
      auth_type = excluded.auth_type,
      protocol = 'mcp',
      mcp_url = excluded.mcp_url,
      status = 'active',
      metadata = public.connector_catalog.metadata || excluded.metadata,
      updated_at = now()
    returning id
  `;
  const connectorId = rows[0]?.id;
  if (!connectorId) throw new Error("MCP catalog upsert failed");
  return connectorId;
}

async function upsertInstallation(
  sql: Sql,
  input: {
    connectorId: string;
    userId: string;
    status: "pending" | "active";
  },
): Promise<string> {
  const inserted = await sql<{ id: string }[]>`
    insert into public.connector_installations (
      connector_id, user_id, status, connected_at
    ) values (
      ${input.connectorId}::uuid, ${input.userId}::uuid, ${input.status},
      ${input.status === "active" ? new Date() : null}
    )
    on conflict do nothing
    returning id
  `;
  if (inserted[0]?.id) return inserted[0].id;
  const existing = await sql<{ id: string }[]>`
    select id from public.connector_installations
    where connector_id = ${input.connectorId}::uuid
      and user_id = ${input.userId}::uuid
      and workspace_id is null
    limit 1
  `;
  const installationId = existing[0]?.id;
  if (!installationId) throw new Error("MCP installation could not be created");
  await sql`
    update public.connector_installations
    set status = ${input.status},
        last_error_code = null,
        last_error_at = null,
        connected_at = case
          when ${input.status} = 'active' then coalesce(connected_at, now())
          else connected_at
        end,
        updated_at = now()
    where id = ${installationId}::uuid
  `;
  return installationId;
}

export async function installMcpPlugin(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userId: string,
): Promise<Response> {
  const body = await readJsonObject(request);
  const pluginId = stringField(body, "pluginId", { required: true, max: 200 })!;
  const displayName = stringField(body, "displayName", {
    required: true,
    max: 160,
  })!;
  const mcpUrl = httpsUrl(
    stringField(body, "mcpUrl", { required: true, max: 2000 })!,
    "mcpUrl",
  );
  const logoUrl = stringField(body, "logoUrl", { max: 2000 });
  const returnUrl = allowedReturnUrl(
    stringField(body, "returnUrl", { required: true })!,
    env,
  );
  const connectorKey = await mcpConnectorKey(pluginId);

  const client = new WorkerMcpClient(mcpUrl);
  let probe: Awaited<ReturnType<WorkerMcpClient["probe"]>>;
  try {
    probe = await client.probe();
  } catch (error) {
    throw new HttpError(
      error instanceof Error
        ? error.message
        : "This plugin's MCP server could not be reached.",
      502,
      "mcp_unreachable",
    );
  } finally {
    await client.close();
  }

  return withDatabase(env, async (sql) => {
    try {
    if (probe.authorized) {
      const connectorId = await upsertMcpCatalog(sql, {
        connectorKey,
        pluginId,
        displayName,
        mcpUrl,
        logoUrl,
        authType: "none",
      });
      const installationId = await upsertInstallation(sql, {
        connectorId,
        userId,
        status: "active",
      });
      let synced = { tools: 0, skills: 0 };
      try {
        synced = await syncMcpTools(sql, {
          connectorId,
          installationId,
          mcpUrl,
        });
      } catch {
        // Tools can be refreshed on the next chat turn / reconnect.
      }
      enqueueAudit(env, ctx, {
        userId,
        installationId,
        connectorKey,
        eventType: "mcp_connected",
        status: "succeeded",
        metadata: { pluginId, auth: "none", ...synced },
      });
      return json({
        data: {
          status: "connected",
          connectorKey,
          installationId,
          authorizeUrl: null,
          toolCount: synced.tools,
          skillCount: synced.skills,
        },
      });
    }

    const discovery = await discoverAuthorization(
      mcpUrl,
      probe.resourceMetadataUrl,
    );
    const redirectUri = new URL(
      `/v1/oauth/callback/${encodeURIComponent(connectorKey)}`,
      request.url,
    ).toString();
    const connectorId = await upsertMcpCatalog(sql, {
      connectorKey,
      pluginId,
      displayName,
      mcpUrl,
      logoUrl,
      authType: "mcp_oauth2",
    });
    const existing = await sql<{ client_id: string }[]>`
      select client_id
      from private.connector_oauth_configs
      where connector_id = ${connectorId}::uuid
      limit 1
    `;
    let clientId = existing[0]?.client_id ?? "";
    let registration: "cimd" | "dcr" | "existing" = existing[0]
      ? "existing"
      : "dcr";
    if (!clientId) {
      const metadataUrl = discovery.clientIdMetadataDocumentSupported
        ? clientMetadataUrlFor(returnUrl, connectorKey)
        : null;
      if (metadataUrl) {
        clientId = metadataUrl;
        registration = "cimd";
        await sql`
          insert into private.connector_oauth_configs (
            connector_id, client_id, encrypted_client_secret, client_secret_nonce,
            authorization_endpoint, token_endpoint, revocation_endpoint,
            api_base_url, client_auth_method, scopes, authorization_params,
            token_params, supports_pkce, enabled
          ) values (
            ${connectorId}::uuid, ${metadataUrl},
            null, null,
            ${discovery.authorizationEndpoint}, ${discovery.tokenEndpoint},
            ${discovery.revocationEndpoint}, ${mcpUrl},
            'none', ${textArray(sql, discovery.scopes)},
            ${sql.json({ resource: discovery.resource })},
            ${sql.json({ resource: discovery.resource })},
            true, true
          )
          on conflict (connector_id) do update set
            client_id = excluded.client_id,
            encrypted_client_secret = null,
            client_secret_nonce = null,
            authorization_endpoint = excluded.authorization_endpoint,
            token_endpoint = excluded.token_endpoint,
            revocation_endpoint = excluded.revocation_endpoint,
            api_base_url = excluded.api_base_url,
            client_auth_method = 'none',
            scopes = excluded.scopes,
            authorization_params = excluded.authorization_params,
            token_params = excluded.token_params,
            supports_pkce = true,
            enabled = true,
            updated_at = now()
        `;
      } else {
        if (!discovery.registrationEndpoint) {
          throw new HttpError(
            "This plugin requires OAuth but does not support automatic client registration.",
            409,
            "mcp_oauth_registration_required",
          );
        }
        const registered = await registerOAuthClient(
          discovery.registrationEndpoint,
          redirectUri,
        );
        clientId = registered.clientId;
        const sealedSecret = registered.clientSecret
          ? await sealText(
              registered.clientSecret,
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
            ${connectorId}::uuid, ${registered.clientId},
            ${sealedSecret?.ciphertext ?? null}, ${sealedSecret?.nonce ?? null},
            ${discovery.authorizationEndpoint}, ${discovery.tokenEndpoint},
            ${discovery.revocationEndpoint}, ${mcpUrl},
            ${registered.authMethod}, ${textArray(sql, discovery.scopes)},
            ${sql.json({ resource: discovery.resource })},
            ${sql.json({ resource: discovery.resource })},
            true, true
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
            supports_pkce = true,
            enabled = true,
            updated_at = now()
        `;
      }
    } else {
      await sql`
        update private.connector_oauth_configs
        set authorization_endpoint = ${discovery.authorizationEndpoint},
            token_endpoint = ${discovery.tokenEndpoint},
            revocation_endpoint = ${discovery.revocationEndpoint},
            api_base_url = ${mcpUrl},
            scopes = ${textArray(sql, discovery.scopes)},
            authorization_params = ${sql.json({ resource: discovery.resource })},
            token_params = ${sql.json({ resource: discovery.resource })},
            supports_pkce = true,
            enabled = true,
            updated_at = now()
        where connector_id = ${connectorId}::uuid
      `;
    }
    await upsertInstallation(sql, {
      connectorId,
      userId,
      status: "pending",
    });

    const state = randomUrlSafe(32);
    const verifier = randomUrlSafe(48);
    const stateHash = await sha256(state);
    const verifierEnvelope = await sealText(
      verifier,
      env.CONNECTOR_ENCRYPTION_KEY,
      `oauth-transaction:${stateHash}`,
    );
    const ttlSeconds = Math.min(
      900,
      Math.max(300, Number(env.OAUTH_TRANSACTION_TTL_SECONDS) || 600),
    );
    await sql`
      insert into private.connector_oauth_transactions (
        state_hash, connector_id, user_id, workspace_id,
        encrypted_code_verifier, code_verifier_nonce, redirect_uri,
        return_url, requested_scopes, expires_at
      ) values (
        ${stateHash}, ${connectorId}::uuid, ${userId}::uuid, null,
        ${verifierEnvelope.ciphertext}, ${verifierEnvelope.nonce},
        ${redirectUri}, ${returnUrl}, ${textArray(sql, discovery.scopes)},
        now() + (${ttlSeconds} * interval '1 second')
      )
    `;

    const authorize = new URL(discovery.authorizationEndpoint);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", await pkceChallenge(verifier));
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("resource", discovery.resource);
    if (discovery.scopes.length > 0) {
      authorize.searchParams.set("scope", discovery.scopes.join(" "));
    }

    enqueueAudit(env, ctx, {
      userId,
      connectorKey,
      eventType: "oauth_started",
      status: "succeeded",
      metadata: { pluginId, auth: "mcp_oauth2", registration },
    });

    return json({
      data: {
        status: "authorization_required",
        connectorKey,
        installationId: null,
        authorizeUrl: authorize.toString(),
        expiresIn: ttlSeconds,
      },
    });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        "Unable to add this plugin.",
        502,
        "mcp_install_failed",
      );
    }
  });
}

export type { McpPrompt };
