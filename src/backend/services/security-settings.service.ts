import { AppError, notFound } from "@/backend/db/errors";
import { query } from "@/backend/db/pool";
import * as connectedAccountsRepo from "@/backend/repositories/connected-accounts.repository";

export type SecuritySession = {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export async function getSecuritySettings(userId: string) {
  const [sessions, linkedProviders, connectorInstallations] = await Promise.all([
    listSecuritySessions(userId),
    connectedAccountsRepo.listConnectedAccounts(userId),
    connectedAccountsRepo.listConnectorInstallations(userId),
  ]);

  return {
    sessions,
    linkedProviders: linkedProviders.map((account) => ({
      id: account.id,
      provider: account.provider,
      providerAccountId: account.provider_account_id,
      scopes: account.scopes,
      status: account.status,
      connectedAt: account.connected_at,
    })),
    connectorInstallations: connectorInstallations.map((row) => ({
      id: row.id,
      connectorId: row.connector_id,
      connectorKey: row.connector_key,
      connectorName: row.connector_name,
      status: row.status,
      lastSyncedAt: row.last_synced_at,
      connectedAt: row.created_at,
    })),
  };
}

async function listSecuritySessions(userId: string, limit = 25) {
  const rows = await query<{
    id: string;
    event_type: string;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `select id, event_type, host(ip_address) as ip_address, user_agent, metadata, created_at
     from public.user_security_events
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, limit],
  );

  return rows.map(
    (row): SecuritySession => ({
      id: row.id,
      eventType: row.event_type,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    }),
  );
}

export async function listConnectedAccountsForUser(userId: string) {
  const [accounts, installations] = await Promise.all([
    connectedAccountsRepo.listConnectedAccounts(userId),
    connectedAccountsRepo.listConnectorInstallations(userId),
  ]);
  return { accounts, installations };
}

export async function disconnectAccount(
  userId: string,
  input: { accountId?: string; installationId?: string },
) {
  if (input.accountId) {
    const revoked = await connectedAccountsRepo.revokeConnectedAccount(
      input.accountId,
      userId,
    );
    if (!revoked) throw notFound("Connected account not found.");
    return { type: "account" as const, id: revoked.id };
  }

  if (input.installationId) {
    const revoked = await connectedAccountsRepo.revokeConnectorInstallation(
      input.installationId,
      userId,
    );
    if (!revoked) throw notFound("Connector installation not found.");
    return { type: "connector" as const, id: revoked.id };
  }

  throw new AppError("accountId or installationId is required.", 400);
}
