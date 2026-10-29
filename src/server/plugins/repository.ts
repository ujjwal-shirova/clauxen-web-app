import { query, queryOne, withTransaction } from "@/server/db/pool";
import type { ConnectorId, ConnectorApproval } from "@/lib/plugin-connectors";
import { connectorError } from "./crypto";

export type ConnectionRow = {
  id: string; user_id: string; plugin_id: ConnectorId; account_label: string;
  status: "active" | "reauthorization_required"; granted_scopes: string[];
  metadata: Record<string, unknown>; credentials_sealed: string; revision: string | number;
  connected_at: Date | string;
};
export type StateRow = {
  id: string; user_id: string; plugin_id: ConnectorId; state_hash: string;
  browser_hash: string; data_sealed: string;
};
export type ActionRow = {
  id: string; user_id: string; connection_id: string; connection_revision: string | number;
  plugin_id: ConnectorId; tool_name: string; title: string; schema_hash: string; request_hash: string;
  arguments_sealed: string | null; result_sealed: string | null;
  status: ConnectorApproval["status"]; expires_at: Date | string;
};
export type ConnectionUpdate = Pick<ConnectionRow, "credentials_sealed" | "account_label" | "granted_scopes" | "metadata" | "status">;

/** Injectable behavioral boundary; tests don't impersonate pg or claim migration execution. */
export interface ConnectorRepository {
  listConnections(userId: string): Promise<ConnectionRow[]>;
  getConnection(userId: string, pluginId: ConnectorId): Promise<ConnectionRow | null>;
  saveConnection(userId: string, pluginId: ConnectorId, id: string, value: ConnectionUpdate): Promise<ConnectionRow>;
  withLockedConnection<T>(userId: string, connectionId: string, run: (row: ConnectionRow, save: (value: ConnectionUpdate) => Promise<void>) => Promise<T>): Promise<T>;
  deleteConnection(userId: string, connectionId: string): Promise<ConnectionRow | null>;
  putState(row: StateRow): Promise<void>;
  consumeState(userId: string, pluginId: ConnectorId, stateHash: string, browserHash: string): Promise<StateRow | null>;
  listActions(userId: string): Promise<ActionRow[]>;
  createAction(row: ActionRow): Promise<ActionRow>;
  claimAction(userId: string, actionId: string, decision: "approve" | "reject"): Promise<ActionRow | null>;
  finishAction(userId: string, actionId: string, status: "complete" | "failed" | "unknown", resultSealed: string): Promise<void>;
  githubDetails(userId: string): Promise<{ configured: boolean; login: string | null }>;
}

export const connectorRepository: ConnectorRepository = {
  listConnections: (userId) => query<ConnectionRow>("select * from private.plugin_connector_connections where user_id=$1 order by connected_at desc limit 20", [userId]),
  getConnection: (userId, pluginId) => queryOne<ConnectionRow>("select * from private.plugin_connector_connections where user_id=$1 and plugin_id=$2", [userId, pluginId]),
  async saveConnection(userId, pluginId, id, value) {
    // Lock the existing row before choosing its AAD identity; callers use the existing ID.
    const row = await queryOne<ConnectionRow>(`insert into private.plugin_connector_connections
      (id,user_id,plugin_id,credentials_sealed,account_label,granted_scopes,metadata,status)
      values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(user_id,plugin_id) do update set
      credentials_sealed=excluded.credentials_sealed,account_label=excluded.account_label,
      granted_scopes=excluded.granted_scopes,metadata=excluded.metadata,status=excluded.status,
      connected_at=now(),updated_at=now(),revision=private.plugin_connector_connections.revision+1
      where private.plugin_connector_connections.id=excluded.id returning *`,
      [id, userId, pluginId, value.credentials_sealed, value.account_label, value.granted_scopes, value.metadata, value.status]);
    if (!row) throw connectorError("Connection changed. Please start connecting again.", 409);
    return row;
  },
  withLockedConnection(userId, connectionId, run) {
    return withTransaction(async (db) => {
      await db.query("SET LOCAL lock_timeout='1s'; SET LOCAL idle_in_transaction_session_timeout='12s'");
      const row = (await db.query<ConnectionRow>("select * from private.plugin_connector_connections where id=$1 and user_id=$2 for update", [connectionId, userId])).rows[0];
      if (!row) throw connectorError("Connection not found. Connect this account first.", 404);
      return run(row, async (value) => {
        await db.query(`update private.plugin_connector_connections set credentials_sealed=$3,
          account_label=$4,granted_scopes=$5,metadata=$6,status=$7,updated_at=now() where id=$1 and user_id=$2`,
          [connectionId, userId, value.credentials_sealed, value.account_label, value.granted_scopes, value.metadata, value.status]);
      });
    });
  },
  deleteConnection(userId, connectionId) {
    return withTransaction(async (db) => {
      const row = (await db.query<ConnectionRow>("delete from private.plugin_connector_connections where id=$1 and user_id=$2 returning *", [connectionId, userId])).rows[0];
      if (row) {
        await db.query("delete from private.plugin_connector_oauth_states where user_id=$1 and plugin_id=$2", [userId, row.plugin_id]);
        if (row.plugin_id === "github") {
          // Reuse the GitHub flow's local storage; no second OAuth client or token decoder.
          await db.query("delete from private.github_agent_connections where user_id=$1", [userId]);
          await db.query("delete from private.github_agent_states where user_id=$1", [userId]);
        }
      }
      return row ?? null;
    });
  },
  putState(row) {
    return withTransaction(async (db) => {
      // One browser-binding cookie and one outstanding flow per user.
      await db.query("delete from private.plugin_connector_oauth_states where user_id=$1", [row.user_id]);
      await db.query(`insert into private.plugin_connector_oauth_states(id,user_id,plugin_id,state_hash,browser_hash,data_sealed)
        values($1,$2,$3,$4,$5,$6)`, [row.id, row.user_id, row.plugin_id, row.state_hash, row.browser_hash, row.data_sealed]);
    });
  },
  consumeState(userId, pluginId, stateHash, browserHash) {
    return withTransaction(async (db) => (await db.query<StateRow>(`delete from private.plugin_connector_oauth_states
      where user_id=$1 and plugin_id=$2 and state_hash=$3 and browser_hash=$4 and expires_at>now() returning *`,
      [userId, pluginId, stateHash, browserHash])).rows[0] ?? null);
  },
  async listActions(userId) {
    await query(`update private.plugin_connector_actions set
      status=case when status in ('running','approved') then 'unknown' when status='pending' then 'failed' else status end,
      arguments_sealed=null,result_sealed=null,updated_at=now()
      where user_id=$1 and expires_at<=now() and (arguments_sealed is not null or result_sealed is not null)`, [userId]);
    await query("delete from private.plugin_connector_oauth_states where user_id=$1 and expires_at<=now()", [userId]);
    return query<ActionRow>("select * from private.plugin_connector_actions where user_id=$1 and expires_at>now() order by created_at desc limit 50", [userId]);
  },
  async createAction(row) {
    const saved = await queryOne<ActionRow>(`insert into private.plugin_connector_actions
      (id,user_id,connection_id,connection_revision,plugin_id,tool_name,title,schema_hash,request_hash,arguments_sealed)
      select $1,$2,c.id,c.revision,$5,$6,$7,$8,$9,$10 from private.plugin_connector_connections c
      where c.id=$3 and c.user_id=$2 and c.plugin_id=$5 and c.revision=$4 and c.status='active'
      on conflict(user_id,request_hash) where status='pending' do update set title=private.plugin_connector_actions.title
      returning *`, [row.id, row.user_id, row.connection_id, row.connection_revision, row.plugin_id, row.tool_name, row.title, row.schema_hash, row.request_hash, row.arguments_sealed]);
    if (!saved) throw connectorError("Connection changed. Reconnect and request the action again.", 409);
    if (new Date(saved.expires_at).getTime() <= Date.now()) {
      await query("update private.plugin_connector_actions set status='failed',arguments_sealed=null where id=$1 and user_id=$2 and status='pending'", [saved.id, row.user_id]);
      throw connectorError("The prior approval expired. Request the action again.", 409);
    }
    return saved;
  },
  claimAction(userId, actionId, decision) {
    return withTransaction(async (db) => {
      const action = (await db.query<ActionRow>(`update private.plugin_connector_actions a set
        status=$3,arguments_sealed=case when $3='failed' then null else a.arguments_sealed end,updated_at=now()
        from private.plugin_connector_connections c where a.id=$1 and a.user_id=$2 and a.status='pending'
        and a.expires_at>now() and c.id=a.connection_id and c.user_id=$2 and c.plugin_id=a.plugin_id
        and c.revision=a.connection_revision and c.status='active' returning a.*`,
        [actionId, userId, decision === "reject" ? "failed" : "approved"])).rows[0];
      if (!action) return null;
      if (decision === "approve") {
        await db.query("update private.plugin_connector_actions set status='running',updated_at=now() where id=$1 and user_id=$2 and status='approved'", [actionId, userId]);
        action.status = "running";
      }
      return action;
    });
  },
  async finishAction(userId, actionId, status, resultSealed) {
    await query(`update private.plugin_connector_actions set status=$3,arguments_sealed=null,
      result_sealed=case when expires_at>now() then $4 else null end,updated_at=now()
      where id=$1 and user_id=$2 and status='running'`, [actionId, userId, status, resultSealed]);
  },
  async githubDetails(userId) {
    const row = await queryOne<{ configured: boolean; login: string | null }>(`select
      exists(select 1 from private.github_agent_app where singleton) as configured,
      (select login from private.github_agent_connections where user_id=$1) as login`, [userId]);
    return row ?? { configured: false, login: null };
  },
};
