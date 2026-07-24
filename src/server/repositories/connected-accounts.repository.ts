import { query, queryOne } from "@/server/db/pool";

export type ConnectedAccountRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string | null;
  scopes: string[];
  status: string;
  connected_at: string;
  updated_at: string;
};

export type ConnectorInstallationRow = {
  id: string;
  connector_id: string;
  connector_key: string | null;
  connector_name: string | null;
  user_id: string;
  workspace_id: string | null;
  status: string;
  settings: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listConnectedAccounts(userId: string) {
  return query<ConnectedAccountRow>(
    `select id, user_id, provider, provider_account_id, scopes, status,
            connected_at, updated_at
     from public.connected_accounts
     where user_id = $1 and status = 'active'
     order by connected_at desc`,
    [userId],
  );
}

export async function getConnectedAccount(accountId: string, userId: string) {
  return queryOne<ConnectedAccountRow>(
    `select id, user_id, provider, provider_account_id, scopes, status,
            connected_at, updated_at
     from public.connected_accounts
     where id = $1 and user_id = $2`,
    [accountId, userId],
  );
}

export async function revokeConnectedAccount(accountId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.connected_accounts
     set status = 'revoked', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id`,
    [accountId, userId],
  );
}

export async function listConnectorInstallations(userId: string) {
  return query<ConnectorInstallationRow>(
    `select ci.id, ci.connector_id, cc.key as connector_key, cc.name as connector_name,
            ci.user_id, ci.workspace_id, ci.status, ci.settings, ci.last_synced_at,
            ci.created_at, ci.updated_at
     from public.connector_installations ci
     left join public.connector_catalog cc on cc.id = ci.connector_id
     where ci.user_id = $1 and ci.status = 'active'
     order by ci.updated_at desc`,
    [userId],
  );
}

export async function getConnectorInstallation(
  installationId: string,
  userId: string,
) {
  return queryOne<ConnectorInstallationRow>(
    `select ci.id, ci.connector_id, cc.key as connector_key, cc.name as connector_name,
            ci.user_id, ci.workspace_id, ci.status, ci.settings, ci.last_synced_at,
            ci.created_at, ci.updated_at
     from public.connector_installations ci
     left join public.connector_catalog cc on cc.id = ci.connector_id
     where ci.id = $1 and ci.user_id = $2`,
    [installationId, userId],
  );
}

export async function revokeConnectorInstallation(
  installationId: string,
  userId: string,
) {
  return queryOne<{ id: string }>(
    `update public.connector_installations
     set status = 'revoked', updated_at = now()
     where id = $1 and user_id = $2 and status = 'active'
     returning id`,
    [installationId, userId],
  );
}
