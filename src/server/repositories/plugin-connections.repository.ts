import type { PoolClient } from "pg";
import { query, queryOne } from "@/server/db/pool";
import type { ToolRisk } from "@/server/plugins/rest-toolsets";

/**
 * Persistence for plugin connections.
 *
 * Token material is never selected through the public row type. Sealed blobs
 * live in private.plugin_oauth_tokens and are read only by the token manager
 * at call time.
 */

export type ConnectionStatus =
  | "pending"
  | "active"
  | "reauthorization_required"
  | "revoked"
  | "error";

export type PermissionMode = "read_only" | "read_write";

export type PluginConnectionRow = {
  id: string;
  user_id: string;
  plugin_id: string;
  plugin_name: string;
  plugin_icon_url: string | null;
  connector_kind: "mcp" | "rest";
  mcp_url: string | null;
  auth_type: "mcp_oauth2" | "oauth2" | "none";
  status: ConnectionStatus;
  permission_mode: PermissionMode;
  account_label: string | null;
  authorization_server: string | null;
  granted_scopes: string[];
  connected_at: string | null;
  last_used_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type OAuthMeta = {
  provider?: string | null;
  issuer?: string | null;
  tokenEndpoint?: string | null;
  revocationEndpoint?: string | null;
  clientId?: string | null;
  tokenAuthMethod?: "none" | "client_secret_post" | "client_secret_basic";
  resource?: string | null;
  toolset?: string | null;
};

export type SealedTokens = {
  access_token_sealed: string;
  refresh_token_sealed: string | null;
  client_secret_sealed: string | null;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  oauth_meta: OAuthMeta;
  updated_at: string;
};

export type PluginConnectionToolRow = {
  connection_id: string;
  tool_name: string;
  title: string;
  description: string;
  input_schema: Record<string, unknown>;
  risk_level: ToolRisk;
  is_enabled: boolean;
};

export type CapabilityRow = {
  kind: "resource" | "prompt";
  name: string;
  title: string;
  description: string;
  uri: string | null;
};

export type ToolCallRow = {
  id: string;
  tool_name: string;
  risk_level: ToolRisk;
  status: "ok" | "error" | "blocked";
  detail: string | null;
  duration_ms: number | null;
  created_at: string;
};

const CONNECTION_COLUMNS = `
  id, user_id, plugin_id, plugin_name, plugin_icon_url, connector_kind, mcp_url,
  auth_type, status, permission_mode, account_label, authorization_server,
  granted_scopes, connected_at, last_used_at, last_error_code, created_at, updated_at
`;

// ─── connections ────────────────────────────────────────────────────────────

export async function listConnectionsForUser(
  userId: string,
): Promise<Array<PluginConnectionRow & { tool_count: number }>> {
  return query<PluginConnectionRow & { tool_count: number }>(
    `select ${CONNECTION_COLUMNS},
            (select count(*)::int from public.plugin_connection_tools t
              where t.connection_id = c.id) as tool_count
       from public.plugin_connections c
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

export type UpsertConnectionInput = {
  userId: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  connectorKind: "mcp" | "rest";
  mcpUrl: string | null;
  authType: PluginConnectionRow["auth_type"];
  authorizationServer: string | null;
  accountLabel: string | null;
  grantedScopes: string[];
};

/** Create or reactivate the (user, plugin) connection. Returns its id. */
export async function upsertActiveConnection(
  input: UpsertConnectionInput,
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into public.plugin_connections (
       user_id, plugin_id, plugin_name, plugin_icon_url, connector_kind, mcp_url,
       auth_type, status, authorization_server, account_label, granted_scopes,
       connected_at, last_error_code, last_error_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, now(), null, null
     )
     on conflict (user_id, plugin_id) do update set
       plugin_name = excluded.plugin_name,
       plugin_icon_url = excluded.plugin_icon_url,
       connector_kind = excluded.connector_kind,
       mcp_url = excluded.mcp_url,
       auth_type = excluded.auth_type,
       status = 'active',
       authorization_server = excluded.authorization_server,
       account_label = excluded.account_label,
       granted_scopes = excluded.granted_scopes,
       connected_at = now(),
       last_error_code = null,
       last_error_at = null,
       updated_at = now()
     returning id`,
    [
      input.userId,
      input.pluginId,
      input.pluginName,
      input.pluginIconUrl,
      input.connectorKind,
      input.mcpUrl,
      input.authType,
      input.authorizationServer,
      input.accountLabel,
      input.grantedScopes,
    ],
  );
  if (!row) throw new Error("Failed to save plugin connection.");
  return row.id;
}

export async function setConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  lastErrorCode: string | null = null,
): Promise<void> {
  await query(
    `update public.plugin_connections
        set status = $2,
            last_error_code = $3,
            last_error_at = case when $3::text is null then null else now() end,
            updated_at = now()
      where id = $1`,
    [connectionId, status, lastErrorCode],
  );
}

export async function setPermissionMode(
  connectionId: string,
  userId: string,
  mode: PermissionMode,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update public.plugin_connections
        set permission_mode = $3, updated_at = now()
      where id = $1 and user_id = $2 and status <> 'revoked'
      returning id`,
    [connectionId, userId, mode],
  );
  return rows.length > 0;
}

export async function touchConnectionUsage(connectionId: string): Promise<void> {
  await query(
    `update public.plugin_connections
        set last_used_at = now()
      where id = $1`,
    [connectionId],
  );
}

/** Mark revoked and drop every secret and cached capability. */
export async function revokeConnection(
  connectionId: string,
  userId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update public.plugin_connections
        set status = 'revoked', updated_at = now()
      where id = $1 and user_id = $2 and status <> 'revoked'
      returning id`,
    [connectionId, userId],
  );
  if (rows.length === 0) return false;
  await query(`delete from private.plugin_oauth_tokens where connection_id = $1`, [
    connectionId,
  ]);
  await query(`delete from public.plugin_connection_tools where connection_id = $1`, [
    connectionId,
  ]);
  await query(
    `delete from public.plugin_connection_capabilities where connection_id = $1`,
    [connectionId],
  );
  return true;
}

// ─── sealed tokens ──────────────────────────────────────────────────────────

export type WriteTokensInput = {
  accessTokenSealed: string;
  refreshTokenSealed: string | null;
  clientSecretSealed: string | null;
  tokenType: string;
  expiresAt: string | null;
  scopes: string[];
  oauthMeta: OAuthMeta;
};

export async function writeSealedTokens(
  connectionId: string,
  tokens: WriteTokensInput,
): Promise<void> {
  await query(
    `insert into private.plugin_oauth_tokens (
       connection_id, access_token_sealed, refresh_token_sealed, client_secret_sealed,
       token_type, expires_at, scopes, oauth_meta, raw_extras
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb)
     on conflict (connection_id) do update set
       access_token_sealed = excluded.access_token_sealed,
       refresh_token_sealed = excluded.refresh_token_sealed,
       client_secret_sealed = excluded.client_secret_sealed,
       token_type = excluded.token_type,
       expires_at = excluded.expires_at,
       scopes = excluded.scopes,
       oauth_meta = excluded.oauth_meta,
       updated_at = now()`,
    [
      connectionId,
      tokens.accessTokenSealed,
      tokens.refreshTokenSealed,
      tokens.clientSecretSealed,
      tokens.tokenType,
      tokens.expiresAt,
      tokens.scopes,
      JSON.stringify(tokens.oauthMeta),
    ],
  );
}

const TOKEN_COLUMNS = `access_token_sealed, refresh_token_sealed, client_secret_sealed,
  token_type, expires_at, scopes, oauth_meta, updated_at`;

export async function readSealedTokens(
  connectionId: string,
): Promise<SealedTokens | null> {
  return queryOne<SealedTokens>(
    `select ${TOKEN_COLUMNS}
       from private.plugin_oauth_tokens
      where connection_id = $1`,
    [connectionId],
  );
}

/** Row-locked read inside a transaction, so only one refresh runs at a time. */
export async function lockSealedTokens(
  client: PoolClient,
  connectionId: string,
): Promise<SealedTokens | null> {
  const result = await client.query<SealedTokens>(
    `select ${TOKEN_COLUMNS}
       from private.plugin_oauth_tokens
      where connection_id = $1
      for update`,
    [connectionId],
  );
  return result.rows[0] ?? null;
}

export async function rotateSealedTokens(
  client: PoolClient,
  connectionId: string,
  next: {
    accessTokenSealed: string;
    refreshTokenSealed: string | null;
    expiresAt: string | null;
    tokenType: string;
  },
): Promise<void> {
  await client.query(
    `update private.plugin_oauth_tokens
        set access_token_sealed = $2,
            refresh_token_sealed = coalesce($3, refresh_token_sealed),
            expires_at = $4,
            token_type = $5,
            updated_at = now()
      where connection_id = $1`,
    [
      connectionId,
      next.accessTokenSealed,
      next.refreshTokenSealed,
      next.expiresAt,
      next.tokenType,
    ],
  );
}

// ─── OAuth state ────────────────────────────────────────────────────────────

export async function saveOAuthState(input: {
  stateHash: string;
  userId: string;
  pluginId: string;
  payloadSealed: string;
  ttlSeconds: number;
}): Promise<void> {
  await query(`delete from private.plugin_oauth_states where expires_at < now()`);
  await query(
    `insert into private.plugin_oauth_states (
       state_hash, user_id, plugin_id, payload_sealed, expires_at
     ) values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [input.stateHash, input.userId, input.pluginId, input.payloadSealed, input.ttlSeconds],
  );
}

/** Single-use: the row is deleted as it is read. */
export async function consumeOAuthState(
  stateHash: string,
): Promise<{ user_id: string; plugin_id: string; payload_sealed: string } | null> {
  return queryOne<{ user_id: string; plugin_id: string; payload_sealed: string }>(
    `delete from private.plugin_oauth_states
      where state_hash = $1 and expires_at > now()
      returning user_id, plugin_id, payload_sealed`,
    [stateHash],
  );
}

// ─── tools and capabilities ─────────────────────────────────────────────────

export type ToolInput = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: ToolRisk;
};

/** Replace the discovered tools, keeping each tool's on/off choice. */
export async function replaceConnectionTools(
  connectionId: string,
  tools: ToolInput[],
): Promise<void> {
  const names = tools.map((tool) => tool.name);
  await query(
    `delete from public.plugin_connection_tools
      where connection_id = $1 and not (tool_name = any($2::text[]))`,
    [connectionId, names],
  );
  if (tools.length === 0) return;
  await query(
    `insert into public.plugin_connection_tools (
       connection_id, tool_name, title, description, input_schema, risk_level
     )
     select $1, t.name, t.title, t.description, t.input_schema, t.risk
       from jsonb_to_recordset($2::jsonb)
         as t(name text, title text, description text, input_schema jsonb, risk text)
     on conflict (connection_id, tool_name) do update set
       title = excluded.title,
       description = excluded.description,
       input_schema = excluded.input_schema,
       risk_level = excluded.risk_level,
       discovered_at = now()`,
    [
      connectionId,
      JSON.stringify(
        tools.map((tool) => ({
          name: tool.name.slice(0, 200),
          title: tool.title.slice(0, 300),
          description: tool.description.slice(0, 4000),
          input_schema: tool.inputSchema,
          risk: tool.risk,
        })),
      ),
    ],
  );
}

export async function listConnectionTools(
  connectionId: string,
  options: { includeDisabled?: boolean } = {},
): Promise<PluginConnectionToolRow[]> {
  return query<PluginConnectionToolRow>(
    `select connection_id, tool_name, title, description, input_schema, risk_level, is_enabled
       from public.plugin_connection_tools
      where connection_id = $1 ${options.includeDisabled ? "" : "and is_enabled"}
      order by risk_level, tool_name`,
    [connectionId],
  );
}

export async function setToolEnabled(
  connectionId: string,
  toolName: string,
  enabled: boolean,
): Promise<void> {
  await query(
    `update public.plugin_connection_tools
        set is_enabled = $3
      where connection_id = $1 and tool_name = $2`,
    [connectionId, toolName, enabled],
  );
}

export async function replaceCapabilities(
  connectionId: string,
  items: CapabilityRow[],
): Promise<void> {
  await query(
    `delete from public.plugin_connection_capabilities where connection_id = $1`,
    [connectionId],
  );
  if (items.length === 0) return;
  await query(
    `insert into public.plugin_connection_capabilities (
       connection_id, kind, name, title, description, uri
     )
     select $1, c.kind, c.name, c.title, c.description, c.uri
       from jsonb_to_recordset($2::jsonb)
         as c(kind text, name text, title text, description text, uri text)
     on conflict (connection_id, kind, name) do nothing`,
    [
      connectionId,
      JSON.stringify(
        items.slice(0, 200).map((item) => ({
          kind: item.kind,
          name: item.name.slice(0, 300),
          title: item.title.slice(0, 300),
          description: item.description.slice(0, 2000),
          uri: item.uri,
        })),
      ),
    ],
  );
}

export async function listCapabilities(connectionId: string): Promise<CapabilityRow[]> {
  return query<CapabilityRow>(
    `select kind, name, title, description, uri
       from public.plugin_connection_capabilities
      where connection_id = $1
      order by kind, name`,
    [connectionId],
  );
}

// ─── trace ──────────────────────────────────────────────────────────────────

export async function recordToolCall(input: {
  userId: string;
  connectionId: string | null;
  pluginId: string;
  toolName: string;
  risk: ToolRisk;
  status: "ok" | "error" | "blocked";
  detail?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  await query(
    `insert into public.plugin_tool_calls (
       user_id, connection_id, plugin_id, tool_name, risk_level, status, detail, duration_ms
     ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.userId,
      input.connectionId,
      input.pluginId,
      input.toolName.slice(0, 200),
      input.risk,
      input.status,
      input.detail ? input.detail.slice(0, 500) : null,
      input.durationMs ?? null,
    ],
  );
}

export async function listRecentToolCalls(
  connectionId: string,
  limit = 20,
): Promise<ToolCallRow[]> {
  return query<ToolCallRow>(
    `select id::text, tool_name, risk_level, status, detail, duration_ms, created_at
       from public.plugin_tool_calls
      where connection_id = $1
      order by created_at desc
      limit $2`,
    [connectionId, limit],
  );
}
