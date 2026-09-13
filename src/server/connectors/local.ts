import "server-only";

import { AppError } from "@/server/db/errors";
import { query, queryOne, withTransaction } from "@/server/db/pool";
import type { ConnectorConnection } from "@/server/connectors/gateway";

/**
 * Gateway-less connector operations. Used when CONNECTOR_GATEWAY_* env is
 * missing so installs, listing, disconnects, and approval decisions keep
 * working against Postgres directly. Mirrors the worker SQL semantics.
 */

type ConnectionRow = {
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
  connectedAt: Date | string | null;
  lastUsedAt: Date | string | null;
  lastErrorCode: string | null;
  toolCount: number;
  skills: unknown;
};

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export async function listLocalConnections(
  userId: string,
): Promise<{ connections: ConnectorConnection[] }> {
  const rows = await query<ConnectionRow>(
    `select installation.id,
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
     where installation.user_id = $1::uuid
       and installation.status <> 'revoked'
     order by installation.updated_at desc`,
    [userId],
  );
  return {
    connections: rows.map((row) => ({
      ...row,
      connectedAt: iso(row.connectedAt),
      lastUsedAt: iso(row.lastUsedAt),
    })),
  };
}

export async function disconnectLocal(
  userId: string,
  installationId: string,
): Promise<{ installationId: string; disconnected: boolean }> {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `select installation.id
       from public.connector_installations installation
       where installation.id = $1::uuid
         and installation.user_id = $2::uuid
         and installation.status <> 'revoked'
       limit 1`,
      [installationId, userId],
    );
    if (existing.rows.length === 0) {
      throw new AppError("Connection not found.", 404, "connection_not_found");
    }
    await client.query(
      `delete from private.connector_credentials where installation_id = $1::uuid`,
      [installationId],
    );
    await client.query(
      `delete from private.plugin_mcp_api_keys where installation_id = $1::uuid`,
      [installationId],
    );
    await client.query(
      `update public.connector_installations
       set status = 'revoked', granted_scopes = '{}', updated_at = now()
       where id = $1::uuid`,
      [installationId],
    );
    await client.query(
      `insert into public.connector_audit_events
         (user_id, installation_id, event_type, status)
       values ($1::uuid, $2::uuid, 'disconnected', 'succeeded')`,
      [userId, installationId],
    );
    return { installationId, disconnected: true };
  });
}

export async function decideLocalApproval(
  userId: string,
  approvalId: string,
  decision: "approved" | "denied",
): Promise<{ approvalId: string; status: string }> {
  const row = await queryOne<{ id: string }>(
    `update public.connector_action_approvals
     set status = $3, decided_at = now()
     where id = $1::uuid
       and user_id = $2::uuid
       and status = 'pending'
       and expires_at > now()
     returning id`,
    [approvalId, userId, decision],
  );
  if (!row) {
    throw new AppError(
      "Approval is invalid or expired.",
      404,
      "approval_not_found",
    );
  }
  return { approvalId, status: decision };
}
