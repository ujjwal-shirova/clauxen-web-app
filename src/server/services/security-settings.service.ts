import { query } from "@/server/db/pool";

export type SecuritySession = {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export async function getSecuritySettings(userId: string) {
  const sessions = await listSecuritySessions(userId);

  return { sessions };
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

