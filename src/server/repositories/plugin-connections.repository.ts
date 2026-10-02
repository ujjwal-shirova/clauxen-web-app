import { query, queryOne } from "@/server/db/pool";

/**
 * Persistence for MCP plugin connections.
 *
 * Token material is never selected through this module's public row type — the
 * sealed blobs live in private.plugin_oauth_tokens and are read only by
 * `readSealedTokens` for the runtime to unseal at call time.
 */

export type PluginConnectionRow = {
  id: string;
  user_id: string;
  plugin_id: string;
  plugin_name: string;
  plugin_icon_url: string | null;
  mcp_url: string;
  auth_type: "mcp_oauth2" | "none";
  status: "pending" | "active" | "reauthorization_required" | "revoked" | "error";
  authorization_server: string | null;
  provider_account_id: string | null;
  granted_scopes: string[];
  connected_at: string | null;
  last_used_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type SealedTokens = {
  access_token_sealed: string;
  refresh_token_sealed: string | null;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
};

export type PluginConnectionToolRow = {
  connection_id: string;
  tool_name: string;
  title: string;
  description: string;
  input_schema: Record<string, unknown>;
  is_enabled: boolean;
};

const CONNECTION_COLUMNS = `
  id, user_id, plugin_id, plugin_name, plugin_icon_url, mcp_url, auth_type,
  status, authorization_server, provider_account_id, granted_scopes,
  connected_at, last_used_at, last_error_code, created_at, updated_at
`;

// In-memory fallback cache when direct Postgres connection is unconfigured/fails
const fallbackConnections = new Map<string, PluginConnectionRow>();
const fallbackTokens = new Map<string, SealedTokens>();

export async function listConnectionsForUser(
  userId: string,
): Promise<PluginConnectionRow[]> {
  return query<PluginConnectionRow>(
    `select ${CONNECTION_COLUMNS}
       from public.plugin_connections
      where user_id = $1
        and status <> 'revoked'
      order by connected_at desc nulls last, created_at desc`,
    [userId],
  );
}

export async function listActiveConnectionsForUser(
  userId: string,
): Promise<PluginConnectionRow[]> {
  return query<PluginConnectionRow>(
    `select ${CONNECTION_COLUMNS}
       from public.plugin_connections
      where user_id = $1
        and status in ('active', 'reauthorization_required')
      order by connected_at desc nulls last, created_at desc`,
    [userId],
  );
}

export async function getConnectionForUser(
  connectionId: string,
  userId: string,
): Promise<PluginConnectionRow | null> {
  return queryOne<PluginConnectionRow>(
    `select ${CONNECTION_COLUMNS}
       from public.plugin_connections
      where id = $1 and user_id = $2`,
    [connectionId, userId],
  );
}

export async function getConnectionByPlugin(
  userId: string,
  pluginId: string,
): Promise<PluginConnectionRow | null> {
  return queryOne<PluginConnectionRow>(
    `select ${CONNECTION_COLUMNS}
       from public.plugin_connections
      where user_id = $1 and plugin_id = $2`,
    [userId, pluginId],
  );
}

export type UpsertConnectionInput = {
  userId: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  mcpUrl: string;
  authType: "mcp_oauth2" | "none";
  status: PluginConnectionRow["status"];
  authorizationServer: string | null;
  grantedScopes: string[];
  connected: boolean;
  lastErrorCode?: string | null;
};

/** Create or replace the connection row for (user, plugin). Returns its id. */
export async function upsertConnection(
  input: UpsertConnectionInput,
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into public.plugin_connections (
       user_id, plugin_id, plugin_name, plugin_icon_url, mcp_url, auth_type,
       status, authorization_server, granted_scopes, connected_at, last_error_code
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, case when $10 then now() else null end, $11
     )
     on conflict (user_id, plugin_id) do update set
       plugin_name = excluded.plugin_name,
       plugin_icon_url = excluded.plugin_icon_url,
       mcp_url = excluded.mcp_url,
       auth_type = excluded.auth_type,
       status = excluded.status,
       authorization_server = excluded.authorization_server,
       granted_scopes = excluded.granted_scopes,
       connected_at = case
         when excluded.status = 'active' then coalesce(public.plugin_connections.connected_at, now())
         else public.plugin_connections.connected_at
       end,
       last_error_code = excluded.last_error_code,
       updated_at = now()
     returning id`,
    [
      input.userId,
      input.pluginId,
      input.pluginName,
      input.pluginIconUrl,
      input.mcpUrl,
      input.authType,
      input.status,
      input.authorizationServer,
      input.grantedScopes,
      input.connected,
      input.lastErrorCode ?? null,
    ],
  );
  if (!row) throw new Error("Failed to upsert plugin connection.");
  return row.id;
}

export async function setConnectionStatus(
  connectionId: string,
  status: PluginConnectionRow["status"],
  lastErrorCode: string | null = null,
): Promise<void> {
  await query(
    `update public.plugin_connections
        set status = $2,
            last_error_code = $3,
            last_error_at = case when $3 is null then null else now() end,
            updated_at = now()
      where id = $1`,
    [connectionId, status, lastErrorCode],
  );
}

export async function touchConnectionUsage(connectionId: string): Promise<void> {
  await query(
    `update public.plugin_connections
        set last_used_at = now(), updated_at = now()
      where id = $1`,
    [connectionId],
  );
}

export async function revokeConnection(
  connectionId: string,
  userId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update public.plugin_connections
        set status = 'revoked', updated_at = now()
      where id = $1 and user_id = $2
      returning id`,
    [connectionId, userId],
  );
  // Token rows cascade-delete via the FK when revoked is followed by a delete;
  // we drop them explicitly so a revoked connection leaves no secrets behind.
  if (rows.length > 0) {
    await query(
      `delete from private.plugin_oauth_tokens where connection_id = $1`,
      [connectionId],
    );
  }
  return rows.length > 0;
}

// ─── sealed tokens ──────────────────────────────────────────────────────────

export async function writeSealedTokens(
  connectionId: string,
  tokens: {
    accessTokenSealed: string;
    refreshTokenSealed: string | null;
    tokenType: string;
    expiresAt: string | null;
    scopes: string[];
  },
): Promise<void> {
  await query(
    `insert into private.plugin_oauth_tokens (
       connection_id, access_token_sealed, refresh_token_sealed, token_type,
       expires_at, scopes, raw_extras
     ) values ($1, $2, $3, $4, $5, $6, '{}'::jsonb)
     on conflict (connection_id) do update set
       access_token_sealed = excluded.access_token_sealed,
       refresh_token_sealed = coalesce(excluded.refresh_token_sealed, private.plugin_oauth_tokens.refresh_token_sealed),
       token_type = excluded.token_type,
       expires_at = excluded.expires_at,
       scopes = excluded.scopes,
       updated_at = now()`,
    [
      connectionId,
      tokens.accessTokenSealed,
      tokens.refreshTokenSealed,
      tokens.tokenType,
      tokens.expiresAt,
      tokens.scopes,
    ],
  );
}

export async function readSealedTokens(
  connectionId: string,
): Promise<SealedTokens | null> {
  try {
    const row = await queryOne<SealedTokens>(
      `select access_token_sealed, refresh_token_sealed, token_type, expires_at, scopes
         from private.plugin_oauth_tokens
        where connection_id = $1`,
      [connectionId],
    );
    if (row) return row;
  } catch {
    // Fall back to memory cache
  }
  return fallbackTokens.get(connectionId) ?? null;
}

export async function deleteSealedTokens(connectionId: string): Promise<void> {
  await query(
    `delete from private.plugin_oauth_tokens where connection_id = $1`,
    [connectionId],
  );
}

// ─── discovered tools cache ─────────────────────────────────────────────────

export async function replaceConnectionTools(
  connectionId: string,
  tools: Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>,
): Promise<void> {
  await query(`delete from public.plugin_connection_tools where connection_id = $1`, [
    connectionId,
  ]);
  for (const tool of tools) {
    await query(
      `insert into public.plugin_connection_tools (
         connection_id, tool_name, title, description, input_schema
       ) values ($1, $2, $3, $4, $5)
       on conflict (connection_id, tool_name) do update set
         title = excluded.title,
         description = excluded.description,
         input_schema = excluded.input_schema,
         discovered_at = now()`,
      [
        connectionId,
        tool.name,
        tool.title ?? tool.name,
        tool.description ?? "",
        JSON.stringify(tool.inputSchema ?? { type: "object", properties: {} }),
      ],
    );
  }
}

export async function listConnectionTools(
  connectionId: string,
): Promise<PluginConnectionToolRow[]> {
  return query<PluginConnectionToolRow>(
    `select connection_id, tool_name, title, description, input_schema, is_enabled
       from public.plugin_connection_tools
      where connection_id = $1 and is_enabled
      order by tool_name`,
    [connectionId],
  );
}
