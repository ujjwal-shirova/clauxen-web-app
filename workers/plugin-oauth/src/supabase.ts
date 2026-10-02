/**
 * Supabase access for the plugin-oauth worker.
 *
 * Only the service-role key is used here, and only against the
 * `plugin_oauth_*` security-definer RPCs — those are the single gate in and
 * out of `private.plugin_oauth_tokens`. No token value is ever returned to a
 * browser; the app runtime unseals them server-side at tool-call time.
 */

export type CompleteConnectionInput = {
  userId: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  mcpUrl: string;
  authType: "mcp_oauth2" | "none";
  status: "active" | "error" | "reauthorization_required";
  authorizationServer: string | null;
  grantedScopes: string[];
  providerAccountId: string | null;
  accessTokenSealed: string;
  refreshTokenSealed: string | null;
  tokenType: string;
  expiresAt: string | null;
  tokenScopes: string[];
};

export type RefreshPayload = {
  connectionId: string;
  userId: string;
  pluginId: string;
  mcpUrl: string;
  refreshTokenSealed: string | null;
  authorizationServer: string | null;
  grantedScopes: string[];
};

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

async function rpc<T>(
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new SupabaseError(
      `Supabase ${fn} failed (${response.status}): ${text.slice(0, 300)}`,
      response.status,
    );
  }
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Persist the completed connection + sealed tokens. Returns the connection id. */
export async function completeConnection(
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  input: CompleteConnectionInput,
): Promise<string> {
  const id = await rpc<string>(env, "plugin_oauth_complete", {
    p_user_id: input.userId,
    p_plugin_id: input.pluginId,
    p_plugin_name: input.pluginName,
    p_plugin_icon_url: input.pluginIconUrl,
    p_mcp_url: input.mcpUrl,
    p_auth_type: input.authType,
    p_status: input.status,
    p_authorization_server: input.authorizationServer,
    p_granted_scopes: input.grantedScopes,
    p_provider_account_id: input.providerAccountId,
    p_access_token_sealed: input.accessTokenSealed,
    p_refresh_token_sealed: input.refreshTokenSealed,
    p_token_type: input.tokenType,
    p_expires_at: input.expiresAt,
    p_token_scopes: input.tokenScopes,
  });
  if (typeof id !== "string" || id.length === 0) {
    throw new SupabaseError("plugin_oauth_complete returned no connection id.", 500);
  }
  return id;
}

/** Read the sealed refresh token and connection metadata for a refresh. */
export async function readRefreshPayload(
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  connectionId: string,
): Promise<RefreshPayload | null> {
  const rows = await rpc<
    Array<{
      connection_id: string;
      user_id: string;
      plugin_id: string;
      mcp_url: string;
      refresh_token_sealed: string | null;
      authorization_server: string | null;
      granted_scopes: string[];
    }>
  >(env, "plugin_oauth_read_refresh", { p_connection_id: connectionId });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    connectionId: row.connection_id,
    userId: row.user_id,
    pluginId: row.plugin_id,
    mcpUrl: row.mcp_url,
    refreshTokenSealed: row.refresh_token_sealed,
    authorizationServer: row.authorization_server,
    grantedScopes: row.granted_scopes ?? [],
  };
}

/** Write rotated token material back after a refresh. */
export async function rotateTokens(
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  input: {
    connectionId: string;
    accessTokenSealed: string;
    refreshTokenSealed: string | null;
    tokenType: string;
    expiresAt: string | null;
    tokenScopes: string[];
  },
): Promise<void> {
  await rpc(env, "plugin_oauth_rotate", {
    p_connection_id: input.connectionId,
    p_access_token_sealed: input.accessTokenSealed,
    p_refresh_token_sealed: input.refreshTokenSealed,
    p_token_type: input.tokenType,
    p_expires_at: input.expiresAt,
    p_token_scopes: input.tokenScopes,
  });
}
