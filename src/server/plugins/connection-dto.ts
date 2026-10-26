import type { PluginConnectionRow } from "@/server/repositories/plugin-connections.repository";

/** Client-safe view of a connection. Never includes token material. */
export function connectionDto(row: PluginConnectionRow & { tool_count?: number }) {
  return {
    id: row.id,
    pluginId: row.plugin_id,
    pluginName: row.plugin_name,
    pluginIconUrl: row.plugin_icon_url,
    connectorKind: row.connector_kind,
    authType: row.auth_type,
    status: row.status,
    permissionMode: row.permission_mode,
    accountLabel: row.account_label,
    grantedScopes: row.granted_scopes,
    toolCount: row.tool_count ?? null,
    connectedAt: row.connected_at,
    lastUsedAt: row.last_used_at,
  };
}
