import type { Sql } from "postgres";
import { canonicalJson, openText, sealText, sha256 } from "./crypto";
import { withDatabase } from "./db";
import { enqueueAudit } from "./events";
import { recordMetric } from "./metrics";
import { WorkerMcpClient } from "./mcp-client";
import { HttpError, json, readJsonObject, stringField } from "./http";
import {
  oauthConfigByKey,
  readBoundedResponse,
  type OAuthConfigRow,
} from "./oauth";

type InstallationToolRow = {
  installation_id: string;
  connector_id: string;
  connector_key: string;
  connector_name: string;
  protocol: string;
  mcp_url: string | null;
  mcp_tool_name: string | null;
  mcp_kind: string | null;
  tool_name: string;
  tool_title: string;
  description: string;
  input_schema: Record<string, unknown>;
  http_method: string | null;
  path_template: string | null;
  request_config: Record<string, unknown>;
  risk_level: "read" | "write" | "destructive" | "sensitive";
  requires_confirmation: boolean;
  permission_policy: "inherit" | "allow" | "confirm" | "deny" | null;
  encrypted_access_token: string | null;
  access_token_nonce: string | null;
  encrypted_refresh_token: string | null;
  refresh_token_nonce: string | null;
  token_type: string | null;
  expires_at: string | null;
};

type ToolInput = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  httpMethod?: unknown;
  pathTemplate?: unknown;
  requestConfig?: unknown;
  riskLevel?: unknown;
  requiresConfirmation?: unknown;
  enabled?: unknown;
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toolName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{1,79}$/.test(value)) {
    throw new HttpError("Tool name is invalid.", 400, "invalid_tool");
  }
  return value;
}

function methodValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(value.toUpperCase())
  ) {
    throw new HttpError("Tool HTTP method is invalid.", 400, "invalid_tool");
  }
  return value.toUpperCase();
}

export async function configureConnectorTools(
  request: Request,
  env: Env,
  connectorKey: string,
): Promise<Response> {
  const body = await readJsonObject(request);
  if (!Array.isArray(body.tools) || body.tools.length > 200) {
    throw new HttpError(
      "tools must be an array of at most 200 items.",
      400,
      "invalid_body",
    );
  }

  return withDatabase(env, async (sql) => {
    const connectorRows = await sql<{ id: string }[]>`
      select id from public.connector_catalog where key = ${connectorKey} limit 1
    `;
    const connectorId = connectorRows[0]?.id;
    if (!connectorId) {
      throw new HttpError("Connector not found.", 404, "connector_not_found");
    }

    const accepted: string[] = [];
    await sql.begin(async (transactionSql) => {
      for (const raw of body.tools as ToolInput[]) {
        if (!raw || typeof raw !== "object") {
          throw new HttpError(
            "Tool definition is invalid.",
            400,
            "invalid_tool",
          );
        }
        const name = toolName(raw.name);
        const title =
          typeof raw.title === "string" && raw.title.trim()
            ? raw.title.trim().slice(0, 160)
            : name.replace(/_/g, " ");
        const description =
          typeof raw.description === "string"
            ? raw.description.trim().slice(0, 2000)
            : "";
        const httpMethod = methodValue(raw.httpMethod);
        const pathTemplate =
          typeof raw.pathTemplate === "string"
            ? raw.pathTemplate.trim().slice(0, 2000)
            : null;
        if ((httpMethod === null) !== (pathTemplate === null)) {
          throw new HttpError(
            "Tool HTTP method and path template must be configured together.",
            400,
            "invalid_tool",
          );
        }
        if (
          pathTemplate &&
          (!pathTemplate.startsWith("/") ||
            pathTemplate.startsWith("//") ||
            pathTemplate.includes("://"))
        ) {
          throw new HttpError(
            "Tool path template must be an absolute path on the configured provider API.",
            400,
            "invalid_tool",
          );
        }
        const riskLevel =
          typeof raw.riskLevel === "string" &&
          ["read", "write", "destructive", "sensitive"].includes(raw.riskLevel)
            ? raw.riskLevel
            : "read";
        const requiresConfirmation =
          raw.requiresConfirmation === true ||
          riskLevel === "destructive" ||
          riskLevel === "sensitive";

        await transactionSql`
          insert into public.connector_tools (
            connector_id, name, title, description, input_schema,
            output_schema, http_method, path_template, request_config,
            risk_level, requires_confirmation, is_enabled
          ) values (
            ${connectorId}::uuid, ${name}, ${title}, ${description},
            ${transactionSql.json(jsonValue(recordValue(raw.inputSchema)))},
            ${raw.outputSchema ? transactionSql.json(jsonValue(recordValue(raw.outputSchema))) : null},
            ${httpMethod}, ${pathTemplate},
            ${transactionSql.json(jsonValue(recordValue(raw.requestConfig)))},
            ${riskLevel}, ${requiresConfirmation}, ${raw.enabled !== false}
          )
          on conflict (connector_id, name) do update set
            title = excluded.title,
            description = excluded.description,
            input_schema = excluded.input_schema,
            output_schema = excluded.output_schema,
            http_method = excluded.http_method,
            path_template = excluded.path_template,
            request_config = excluded.request_config,
            risk_level = excluded.risk_level,
            requires_confirmation = excluded.requires_confirmation,
            is_enabled = excluded.is_enabled,
            updated_at = now()
        `;
        accepted.push(name);
      }
    });

    return json({ data: { connectorKey, tools: accepted } });
  });
}

export async function listConnections(
  env: Env,
  userId: string,
): Promise<Response> {
  return withDatabase(env, async (sql) => {
    const rows = await sql<
      Array<{
        id: string;
        connectorKey: string;
        connectorName: string;
        provider: string;
        protocol: string;
        pluginId: string | null;
        mcpUrl: string | null;
        logoUrl: string | null;
        status: string;
        accountLabel: string | null;
        grantedScopes: string[];
        connectedAt: string | null;
        lastUsedAt: string | null;
        lastErrorCode: string | null;
        toolCount: number;
        skills: unknown;
      }>
    >`
      select installation.id,
             catalog.key as "connectorKey",
             catalog.name as "connectorName",
             catalog.provider,
             catalog.protocol,
             catalog.metadata->>'pluginId' as "pluginId",
             catalog.mcp_url as "mcpUrl",
             catalog.metadata->>'logoUrl' as "logoUrl",
             installation.status,
             installation.account_label as "accountLabel",
             installation.granted_scopes as "grantedScopes",
             installation.connected_at as "connectedAt",
             installation.last_used_at as "lastUsedAt",
             installation.last_error_code as "lastErrorCode",
             (
               select count(*)::int from public.connector_tools tool
               where tool.connector_id = catalog.id and tool.is_enabled = true
             ) as "toolCount",
             installation.settings->'mcpSkills' as skills
      from public.connector_installations installation
      join public.connector_catalog catalog on catalog.id = installation.connector_id
      where installation.user_id = ${userId}::uuid
        and installation.status <> 'revoked'
      order by installation.updated_at desc
    `;
    return json({ data: { connections: rows } });
  });
}

export async function listTools(env: Env, userId: string): Promise<Response> {
  return withDatabase(env, async (sql) => {
    const rows = await sql<
      Array<{
        connectorKey: string;
        connectorName: string;
        toolName: string;
        description: string;
        inputSchema: Record<string, unknown>;
        mcpKind: string | null;
      }>
    >`
      select catalog.key as "connectorKey", catalog.name as "connectorName",
             tool.name as "toolName", tool.description,
             tool.input_schema as "inputSchema",
             tool.metadata->>'kind' as "mcpKind"
      from public.connector_installations installation
      join public.connector_catalog catalog on catalog.id = installation.connector_id
      join public.connector_tools tool on tool.connector_id = catalog.id
      left join public.connector_tool_permissions permission
        on permission.installation_id = installation.id
       and permission.tool_name = tool.name
      where installation.user_id = ${userId}::uuid
        and installation.status = 'active'
        and tool.is_enabled = true
        and coalesce(permission.policy, 'inherit') <> 'deny'
      order by catalog.key, tool.name
      limit 500
    `;
    const tools = rows.map((row) => {
      const kindLabel =
        row.mcpKind === "skill" ? "MCP skill" : "MCP tool";
      return {
        qualifiedName: `mcp__${row.connectorKey.replace(/[^a-zA-Z0-9_-]/g, "_")}__${row.toolName}`,
        connectorKey: row.connectorKey,
        connectorName: row.connectorName,
        toolName: row.toolName,
        description: `${row.description || row.toolName} ${kindLabel} from ${row.connectorName}. Connected Clauxen plugin: ${row.connectorName}.`,
        inputSchema: row.inputSchema,
      };
    });
    return json({ data: { tools } });
  });
}

async function toolRow(
  sql: Sql,
  userId: string,
  connectorKey: string,
  name: string,
): Promise<InstallationToolRow | null> {
  const rows = await sql<InstallationToolRow[]>`
    select installation.id as installation_id,
           catalog.id as connector_id,
           catalog.key as connector_key,
           catalog.name as connector_name,
           catalog.protocol,
           catalog.mcp_url,
           tool.metadata->>'mcpName' as mcp_tool_name,
           tool.metadata->>'kind' as mcp_kind,
           tool.name as tool_name,
           tool.title as tool_title,
           tool.description,
           tool.input_schema,
           tool.http_method,
           tool.path_template,
           tool.request_config,
           tool.risk_level,
           tool.requires_confirmation,
           permission.policy as permission_policy,
           credential.encrypted_access_token,
           credential.access_token_nonce,
           credential.encrypted_refresh_token,
           credential.refresh_token_nonce,
           credential.token_type,
           credential.expires_at
    from public.connector_installations installation
    join public.connector_catalog catalog on catalog.id = installation.connector_id
    join public.connector_tools tool on tool.connector_id = catalog.id
    left join private.connector_credentials credential
      on credential.installation_id = installation.id
    left join public.connector_tool_permissions permission
      on permission.installation_id = installation.id
     and permission.tool_name = tool.name
    where installation.user_id = ${userId}::uuid
      and installation.status = 'active'
      and catalog.key = ${connectorKey}
      and tool.name = ${name}
      and tool.is_enabled = true
    limit 1
  `;
  return rows[0] ?? null;
}

function approvalRequired(row: InstallationToolRow): boolean {
  if (row.permission_policy === "allow") return false;
  if (row.permission_policy === "confirm") return true;
  return (
    row.requires_confirmation ||
    row.risk_level === "write" ||
    row.risk_level === "destructive" ||
    row.risk_level === "sensitive"
  );
}

async function consumeApproval(
  sql: Sql,
  input: {
    approvalId: string | null;
    userId: string;
    installationId: string;
    toolName: string;
    argumentsHash: string;
  },
): Promise<boolean> {
  if (!input.approvalId) return false;
  const rows = await sql<{ id: string }[]>`
    update public.connector_action_approvals
    set status = 'consumed', consumed_at = now()
    where id = ${input.approvalId}::uuid
      and user_id = ${input.userId}::uuid
      and installation_id = ${input.installationId}::uuid
      and tool_name = ${input.toolName}
      and arguments_hash = ${input.argumentsHash}
      and status = 'approved'
      and expires_at > now()
    returning id
  `;
  return rows.length === 1;
}

async function requestApproval(
  sql: Sql,
  userId: string,
  row: InstallationToolRow,
  argumentsHash: string,
): Promise<Response> {
  const rows = await sql<{ id: string; expires_at: string }[]>`
    insert into public.connector_action_approvals (
      user_id, installation_id, tool_name, arguments_hash
    ) values (
      ${userId}::uuid, ${row.installation_id}::uuid,
      ${row.tool_name}, ${argumentsHash}
    )
    returning id, expires_at
  `;
  const approval = rows[0];
  return json({
    data: {
      text: `Confirmation is required before Clauxen can run ${row.tool_title}.`,
      isError: false,
      requiresApproval: true,
      approvalId: approval?.id,
      expiresAt: approval?.expires_at,
      action: {
        connector: row.connector_name,
        tool: row.tool_title,
        risk: row.risk_level,
      },
    },
  });
}

async function decryptClientSecret(
  config: OAuthConfigRow,
  env: Env,
): Promise<string | null> {
  if (!config.encrypted_client_secret || !config.client_secret_nonce)
    return null;
  return openText(
    config.encrypted_client_secret,
    config.client_secret_nonce,
    env.CONNECTOR_ENCRYPTION_KEY,
    `oauth-client:${config.connector_id}`,
  );
}

async function refreshAccessToken(
  sql: Sql,
  env: Env,
  row: InstallationToolRow,
  config: OAuthConfigRow,
): Promise<string> {
  const currentExpiry = row.expires_at
    ? Date.parse(row.expires_at)
    : Number.POSITIVE_INFINITY;
  if (currentExpiry > Date.now() + 60_000) {
    if (!row.encrypted_access_token || !row.access_token_nonce) {
      throw new HttpError(
        "Reconnect this plugin before using it.",
        409,
        "reauthorization_required",
      );
    }
    return openText(
      row.encrypted_access_token,
      row.access_token_nonce,
      env.CONNECTOR_ENCRYPTION_KEY,
      `installation:${row.installation_id}:access`,
    );
  }
  if (!row.encrypted_refresh_token || !row.refresh_token_nonce) {
    await sql`
      update public.connector_installations
      set status = 'reauthorization_required',
          last_error_code = 'missing_refresh_token', last_error_at = now()
      where id = ${row.installation_id}::uuid
    `;
    throw new HttpError(
      "Reconnect this plugin before using it.",
      409,
      "reauthorization_required",
    );
  }

  const lockId = crypto.randomUUID();
  const leaseRows = await sql<{ acquired: boolean }[]>`
    select private.acquire_connector_refresh_lease(
      ${row.installation_id}::uuid, ${lockId}::uuid, 30
    ) as acquired
  `;
  if (!leaseRows[0]?.acquired) {
    throw new HttpError(
      "The connector is refreshing. Try again shortly.",
      409,
      "refresh_in_progress",
    );
  }

  try {
    const refreshToken = await openText(
      row.encrypted_refresh_token,
      row.refresh_token_nonce,
      env.CONNECTOR_ENCRYPTION_KEY,
      `installation:${row.installation_id}:refresh`,
    );
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.client_id,
    });
    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    });
    const clientSecret = await decryptClientSecret(config, env);
    if (config.client_auth_method === "client_secret_basic" && clientSecret) {
      headers.set(
        "authorization",
        `Basic ${btoa(`${config.client_id}:${clientSecret}`)}`,
      );
      form.delete("client_id");
    } else if (
      config.client_auth_method === "client_secret_post" &&
      clientSecret
    ) {
      form.set("client_secret", clientSecret);
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
    const text = await readBoundedResponse(response, 256 * 1024);
    const payload = recordValue(JSON.parse(text));
    if (!response.ok || typeof payload.access_token !== "string") {
      await sql`
        update public.connector_installations
        set status = 'reauthorization_required',
            last_error_code = 'token_refresh_failed', last_error_at = now()
        where id = ${row.installation_id}::uuid
      `;
      throw new HttpError(
        "Reconnect this plugin before using it.",
        409,
        "reauthorization_required",
      );
    }

    const access = await sealText(
      payload.access_token,
      env.CONNECTOR_ENCRYPTION_KEY,
      `installation:${row.installation_id}:access`,
    );
    const rotatedRefresh =
      typeof payload.refresh_token === "string" && payload.refresh_token
        ? await sealText(
            payload.refresh_token,
            env.CONNECTOR_ENCRYPTION_KEY,
            `installation:${row.installation_id}:refresh`,
          )
        : null;
    const expiresIn = Number(payload.expires_in);
    await sql`
      update private.connector_credentials
      set encrypted_access_token = ${access.ciphertext},
          access_token_nonce = ${access.nonce},
          encrypted_refresh_token = coalesce(
            ${rotatedRefresh?.ciphertext ?? null}, encrypted_refresh_token
          ),
          refresh_token_nonce = coalesce(
            ${rotatedRefresh?.nonce ?? null}, refresh_token_nonce
          ),
          expires_at = ${Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000) : null},
          refresh_lock_id = null,
          refresh_locked_until = null,
          updated_at = now()
      where installation_id = ${row.installation_id}::uuid
        and refresh_lock_id = ${lockId}::uuid
    `;
    return payload.access_token;
  } finally {
    await sql`
      select private.release_connector_refresh_lease(
        ${row.installation_id}::uuid, ${lockId}::uuid
      )
    `;
  }
}

function renderProviderRequest(
  config: OAuthConfigRow,
  row: InstallationToolRow,
  args: Record<string, unknown>,
  accessToken: string,
): { url: string; init: RequestInit } {
  if (!config.api_base_url || !row.http_method || !row.path_template) {
    throw new HttpError(
      "This tool is not configured for execution.",
      409,
      "tool_not_configured",
    );
  }
  const consumed = new Set<string>();
  const path = row.path_template.replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (_match, key: string) => {
      const value = args[key];
      if (value === undefined || value === null) {
        throw new HttpError(
          `Missing path parameter: ${key}.`,
          400,
          "invalid_tool_arguments",
        );
      }
      consumed.add(key);
      return encodeURIComponent(String(value));
    },
  );
  const apiBase = new URL(`${config.api_base_url.replace(/\/+$/, "")}/`);
  const url = new URL(path.replace(/^\/+/, ""), apiBase);
  if (url.origin !== apiBase.origin) {
    throw new HttpError(
      "Tool request must stay on the configured provider API.",
      409,
      "tool_not_configured",
    );
  }
  const remaining = Object.fromEntries(
    Object.entries(args).filter(([key]) => !consumed.has(key)),
  );
  const headers = new Headers({
    accept: "application/json",
    authorization: `${row.token_type || "Bearer"} ${accessToken}`,
    "user-agent": "Clauxen-Connector-Gateway/1.0",
  });
  const staticHeaders = recordValue(row.request_config.headers);
  for (const [key, value] of Object.entries(staticHeaders)) {
    if (
      typeof value === "string" &&
      !["authorization", "cookie", "host"].includes(key.toLowerCase())
    ) {
      headers.set(key, value);
    }
  }
  const init: RequestInit = { method: row.http_method, headers };
  if (row.http_method === "GET" || row.http_method === "DELETE") {
    for (const [key, value] of Object.entries(remaining)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else if (typeof value !== "object") {
        url.searchParams.set(key, String(value));
      }
    }
  } else {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(remaining);
  }
  return { url: url.toString(), init };
}

export async function callTool(
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
  const name = toolName(body.toolName);
  const args = recordValue(body.arguments);
  const approvalId = stringField(body, "approvalId", { max: 36 });
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const started = Date.now();

  return withDatabase(env, async (sql) => {
    const row = await toolRow(sql, userId, connectorKey, name);
    if (!row) {
      throw new HttpError(
        "Installed connector tool was not found.",
        404,
        "tool_not_found",
      );
    }
    if (row.permission_policy === "deny") {
      throw new HttpError(
        "This tool is disabled for your account.",
        403,
        "tool_denied",
      );
    }

    const argumentsHash = await sha256(canonicalJson(args));
    if (approvalRequired(row)) {
      const approved = await consumeApproval(sql, {
        approvalId,
        userId,
        installationId: row.installation_id,
        toolName: row.tool_name,
        argumentsHash,
      });
      if (!approved) return requestApproval(sql, userId, row, argumentsHash);
    }

    const config = await oauthConfigByKey(sql, connectorKey);
    try {
      if (row.protocol === "mcp") {
        if (!row.mcp_url) {
          throw new HttpError(
            "This plugin is missing its MCP server URL.",
            409,
            "tool_not_configured",
          );
        }
        let accessToken: string | null = null;
        if (row.encrypted_access_token && row.access_token_nonce) {
          accessToken = config
            ? await refreshAccessToken(sql, env, row, config)
            : await openText(
                row.encrypted_access_token,
                row.access_token_nonce,
                env.CONNECTOR_ENCRYPTION_KEY,
                `installation:${row.installation_id}:access`,
              );
        }
        const client = new WorkerMcpClient(row.mcp_url, accessToken);
        try {
          const outcome =
            row.mcp_kind === "skill"
              ? await client.getPrompt(row.mcp_tool_name || row.tool_name, args)
              : await client.callTool(
                  row.mcp_tool_name || row.tool_name,
                  args,
                );
          await sql`
            update public.connector_installations
            set last_used_at = now(),
                last_error_code = ${outcome.isError ? "mcp_tool_error" : null},
                last_error_at = ${outcome.isError ? new Date() : null},
                updated_at = now()
            where id = ${row.installation_id}::uuid
          `;
          const durationMs = Date.now() - started;
          enqueueAudit(env, ctx, {
            userId,
            installationId: row.installation_id,
            connectorKey,
            eventType: "tool_called",
            toolName: name,
            requestId,
            status: outcome.isError ? "failed" : "succeeded",
            durationMs,
            errorCode: outcome.isError ? "mcp_tool_error" : null,
            metadata: { protocol: "mcp", risk: row.risk_level },
          });
          recordMetric({
            kind: "tool_call",
            route: name,
            status: outcome.isError ? "mcp_error" : "200",
            connectorKey,
            userId,
            durationMs,
          });
          return json({
            data: {
              text: outcome.text,
              isError: outcome.isError,
              status: outcome.isError ? 502 : 200,
            },
          });
        } finally {
          await client.close();
        }
      }

      if (!config) {
        throw new HttpError(
          "Connector OAuth configuration is unavailable.",
          409,
          "connector_not_configured",
        );
      }
      const accessToken = await refreshAccessToken(sql, env, row, config);
      const providerRequest = renderProviderRequest(
        config,
        row,
        args,
        accessToken,
      );
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(providerRequest.url, {
          ...providerRequest.init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const maxBytes = Math.min(
        2 * 1024 * 1024,
        Math.max(64 * 1024, Number(env.TOOL_RESPONSE_MAX_BYTES) || 1024 * 1024),
      );
      const responseText = await readBoundedResponse(response, maxBytes);
      const isError = !response.ok;

      await sql`
        update public.connector_installations
        set last_used_at = now(),
            last_error_code = ${isError ? `provider_http_${response.status}` : null},
            last_error_at = ${isError ? new Date() : null},
            updated_at = now()
        where id = ${row.installation_id}::uuid
      `;
      const durationMs = Date.now() - started;
      enqueueAudit(env, ctx, {
        userId,
        installationId: row.installation_id,
        connectorKey,
        eventType: "tool_called",
        toolName: name,
        requestId,
        status: isError ? "failed" : "succeeded",
        durationMs,
        errorCode: isError ? `provider_http_${response.status}` : null,
        metadata: { providerStatus: response.status, risk: row.risk_level },
      });
      recordMetric({
        kind: "tool_call",
        route: name,
        status: String(response.status),
        connectorKey,
        userId,
        durationMs,
      });

      return json({
        data: {
          text:
            responseText ||
            `(provider returned HTTP ${response.status} with no body)`,
          isError,
          status: response.status,
        },
      });
    } catch (error) {
      const errorCode =
        error instanceof HttpError ? error.code : "tool_execution_failed";
      const durationMs = Date.now() - started;
      enqueueAudit(env, ctx, {
        userId,
        installationId: row.installation_id,
        connectorKey,
        eventType: "tool_called",
        toolName: name,
        requestId,
        status: "failed",
        durationMs,
        errorCode,
      });
      recordMetric({
        kind: "tool_call",
        route: name,
        status: errorCode,
        connectorKey,
        userId,
        durationMs,
      });
      throw error;
    }
  });
}

export async function decideApproval(
  env: Env,
  userId: string,
  approvalId: string,
  decision: "approved" | "denied",
): Promise<Response> {
  return withDatabase(env, async (sql) => {
    const rows = await sql<{ id: string }[]>`
      update public.connector_action_approvals
      set status = ${decision}, decided_at = now()
      where id = ${approvalId}::uuid
        and user_id = ${userId}::uuid
        and status = 'pending'
        and expires_at > now()
      returning id
    `;
    if (rows.length === 0) {
      throw new HttpError(
        "Approval is invalid or expired.",
        404,
        "approval_not_found",
      );
    }
    return json({ data: { approvalId, status: decision } });
  });
}

export async function disconnect(
  env: Env,
  ctx: ExecutionContext,
  userId: string,
  installationId: string,
): Promise<Response> {
  return withDatabase(env, async (sql) => {
    const rows = await sql<{ id: string; connector_key: string }[]>`
      select installation.id, catalog.key as connector_key
      from public.connector_installations installation
      join public.connector_catalog catalog on catalog.id = installation.connector_id
      where installation.id = ${installationId}::uuid
        and installation.user_id = ${userId}::uuid
        and installation.status <> 'revoked'
      limit 1
    `;
    const connection = rows[0];
    if (!connection) {
      throw new HttpError("Connection not found.", 404, "connection_not_found");
    }
    await sql.begin(async (transactionSql) => {
      await transactionSql`
        delete from private.connector_credentials
        where installation_id = ${installationId}::uuid
      `;
      await transactionSql`
        update public.connector_installations
        set status = 'revoked', granted_scopes = '{}', updated_at = now()
        where id = ${installationId}::uuid
      `;
    });
    enqueueAudit(env, ctx, {
      userId,
      installationId,
      connectorKey: connection.connector_key,
      eventType: "disconnected",
      status: "succeeded",
    });
    return json({ data: { installationId, disconnected: true } });
  });
}
