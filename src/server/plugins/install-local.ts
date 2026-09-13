import "server-only";

import { createHash } from "node:crypto";
import { McpClient, type McpPrompt } from "@/server/mcp/client";
import { AppError } from "@/server/db/errors";
import { query, queryOne, withTransaction } from "@/server/db/pool";

export type LocalMcpInstallResult =
  | {
      status: "connected";
      connectorKey: string;
      installationId: string;
      toolCount: number;
      skillCount: number;
    }
  | { status: "authorization_required"; connectorKey: string }
  | { status: "api_key_required"; connectorKey: string };

type McpTool = { name: string; description: string; inputSchema: unknown };

/**
 * Must stay byte-identical to the worker's mcpConnectorKey
 * (workers/connector-gateway/src/mcp-install.ts): sha256 hex of the same
 * personalised string, first 16 chars. Verified against production rows.
 */
export function localMcpConnectorKey(pluginId: string): string {
  const digest = createHash("sha256")
    .update(`clauxen-mcp-plugin:${pluginId}`, "utf8")
    .digest("hex");
  return `mcp-${digest.slice(0, 16)}`;
}

/** Mirrors the worker sanitizer so tool names match across executors. */
function sanitizeToolName(name: string, used: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base || !/^[a-z]/.test(base)) base = `t_${base || "tool"}`;
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

function toJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJson(item)]),
    );
  }
  return null;
}

async function upsertMcpCatalog(input: {
  connectorKey: string;
  pluginId: string;
  displayName: string;
  mcpUrl: string;
  logoUrl: string | null;
}): Promise<string> {
  const provider = new URL(input.mcpUrl).hostname;
  const row = await queryOne<{ id: string }>(
    `insert into public.connector_catalog
       (key, name, provider, auth_type, protocol, mcp_url, scopes, status, metadata)
     values ($1, $2, $3, 'none', 'mcp', $4, '{}'::text[], 'active', $5::jsonb)
     on conflict (key) do update set
       name = excluded.name,
       provider = excluded.provider,
       auth_type = excluded.auth_type,
       protocol = 'mcp',
       mcp_url = excluded.mcp_url,
       status = 'active',
       metadata = public.connector_catalog.metadata || excluded.metadata,
       updated_at = now()
     returning id`,
    [
      input.connectorKey,
      input.displayName,
      provider,
      input.mcpUrl,
      JSON.stringify({
        pluginId: input.pluginId,
        mcpUrl: input.mcpUrl,
        logoUrl: input.logoUrl,
      }),
    ],
  );
  if (!row?.id) throw new Error("MCP catalog upsert failed");
  return row.id;
}

async function upsertInstallation(input: {
  connectorId: string;
  userId: string;
}): Promise<string> {
  const inserted = await queryOne<{ id: string }>(
    `insert into public.connector_installations
       (connector_id, user_id, status, connected_at, settings)
     values ($1::uuid, $2::uuid, 'active', now(), '{"installedVia":"local"}'::jsonb)
     on conflict do nothing
     returning id`,
    [input.connectorId, input.userId],
  );
  if (inserted?.id) return inserted.id;
  const existing = await queryOne<{ id: string }>(
    `select id from public.connector_installations
     where connector_id = $1::uuid and user_id = $2::uuid and workspace_id is null
     limit 1`,
    [input.connectorId, input.userId],
  );
  if (!existing?.id) throw new Error("MCP installation could not be created");
  await query(
    `update public.connector_installations
     set status = 'active',
         last_error_code = null,
         last_error_at = null,
         connected_at = coalesce(connected_at, now()),
         settings = coalesce(settings, '{}'::jsonb) || '{"installedVia":"local"}'::jsonb,
         updated_at = now()
     where id = $1::uuid`,
    [existing.id],
  );
  return existing.id;
}

async function writeMcpTools(
  connectorId: string,
  tools: McpTool[],
  prompts: McpPrompt[],
): Promise<void> {
  const used = new Set<string>();
  const toolRows = tools.slice(0, 200).map((tool) => {
    const name = sanitizeToolName(tool.name, used);
    const risk = /delete|destroy|drop|revoke|wipe|remove_all/i.test(
      `${tool.name} ${tool.description}`,
    )
      ? "sensitive"
      : "read";
    return {
      name,
      title: tool.name.slice(0, 160),
      description: (tool.description || "").slice(0, 2000),
      inputSchema: JSON.stringify(toJson(tool.inputSchema)),
      risk,
      requiresConfirmation: risk !== "read",
      metadata: JSON.stringify({ mcpName: tool.name, kind: "tool" }),
    };
  });
  const skillRows = prompts.slice(0, 50).map((prompt) => {
    const name = sanitizeToolName(`skill ${prompt.name}`, used);
    const properties: Record<string, unknown> = {};
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
    return {
      name,
      title: prompt.name.slice(0, 160),
      description: (prompt.description || "").slice(0, 2000),
      inputSchema: JSON.stringify({
        type: "object",
        properties,
        required,
        additionalProperties: false,
      }),
      risk: "read",
      requiresConfirmation: false,
      metadata: JSON.stringify({ mcpName: prompt.name, kind: "skill" }),
    };
  });

  await withTransaction(async (client) => {
    for (const row of [...toolRows, ...skillRows]) {
      await client.query(
        `insert into public.connector_tools
           (connector_id, name, title, description, input_schema,
            risk_level, requires_confirmation, is_enabled, metadata)
         values ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, true, $8::jsonb)
         on conflict (connector_id, name) do update set
           title = excluded.title,
           description = excluded.description,
           input_schema = excluded.input_schema,
           risk_level = excluded.risk_level,
           requires_confirmation = excluded.requires_confirmation,
           is_enabled = true,
           metadata = excluded.metadata,
           updated_at = now()`,
        [
          connectorId,
          row.name,
          row.title,
          row.description,
          row.inputSchema,
          row.risk,
          row.requiresConfirmation,
          row.metadata,
        ],
      );
    }
    if (used.size > 0) {
      await client.query(
        `update public.connector_tools
         set is_enabled = false, updated_at = now()
         where connector_id = $1::uuid and not (name = any($2))`,
        [connectorId, [...used]],
      );
    }
  });
}

async function syncMcpTools(input: {
  connectorId: string;
  installationId: string;
  mcpUrl: string;
}): Promise<{ tools: number; skills: number }> {
  const client = new McpClient({ id: "local-install", url: input.mcpUrl, headers: {} });
  try {
    const [tools, prompts] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
    ]);
    await writeMcpTools(input.connectorId, tools, prompts);
    await query(
      `update public.connector_installations
       set settings = coalesce(settings, '{}'::jsonb) || $2::jsonb,
           last_synced_at = now(),
           updated_at = now()
       where id = $1::uuid`,
      [
        input.installationId,
        JSON.stringify({
          mcpSkills: prompts.slice(0, 50).map((prompt) => ({
            name: prompt.name,
            description: prompt.description,
          })),
          mcpToolCount: tools.length,
          lastMcpSyncAt: new Date().toISOString(),
        }),
      ],
    );
    return { tools: tools.length, skills: prompts.length };
  } finally {
    await client.close();
  }
}

async function audit(input: {
  userId: string;
  installationId: string | null;
  connectorKey: string;
  eventType: string;
  status: string;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `insert into public.connector_audit_events
         (user_id, installation_id, connector_key, event_type, status, error_code, metadata)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.userId,
        input.installationId,
        input.connectorKey,
        input.eventType,
        input.status,
        input.errorCode ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {
    // Audit is best-effort; never fail an install on it.
  }
}

/**
 * Gateway-less install for open (no-auth) MCP servers. Needs only Postgres.
 * OAuth servers return authorization_required (caller routes to the gateway);
 * 401s without OAuth metadata return api_key_required (caller asks for a key).
 */
export async function installMcpPluginLocal(
  userId: string,
  input: {
    pluginId: string;
    displayName: string;
    mcpUrl: string;
    logoUrl?: string | null;
  },
): Promise<LocalMcpInstallResult> {
  let parsed: URL;
  try {
    parsed = new URL(input.mcpUrl);
  } catch {
    throw new AppError("This plugin's MCP server URL is invalid.", 400, "invalid_mcp_url");
  }
  if (parsed.protocol !== "https:") {
    throw new AppError("This plugin's MCP server URL is invalid.", 400, "invalid_mcp_url");
  }

  const connectorKey = localMcpConnectorKey(input.pluginId);
  const client = new McpClient({ id: connectorKey, url: input.mcpUrl, headers: {} });
  let probe: Awaited<ReturnType<McpClient["probe"]>>;
  try {
    probe = await client.probe();
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "This plugin's MCP server could not be reached.",
      502,
      "mcp_unreachable",
    );
  } finally {
    await client.close();
  }

  if (!probe.authorized) {
    return probe.resourceMetadataUrl
      ? { status: "authorization_required", connectorKey }
      : { status: "api_key_required", connectorKey };
  }

  try {
    const connectorId = await upsertMcpCatalog({
      connectorKey,
      pluginId: input.pluginId,
      displayName: input.displayName,
      mcpUrl: input.mcpUrl,
      logoUrl: input.logoUrl ?? null,
    });
    const installationId = await upsertInstallation({ connectorId, userId });
    let synced = { tools: 0, skills: 0 };
    try {
      synced = await syncMcpTools({ connectorId, installationId, mcpUrl: input.mcpUrl });
    } catch {
      // Tools refresh on next use; the install itself stands.
    }
    await audit({
      userId,
      installationId,
      connectorKey,
      eventType: "mcp_connected",
      status: "succeeded",
      metadata: { pluginId: input.pluginId, auth: "none", via: "local", ...synced },
    });
    return { status: "connected", connectorKey, installationId, toolCount: synced.tools, skillCount: synced.skills };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Unable to add this plugin.", 502, "mcp_install_failed");
  }
}
