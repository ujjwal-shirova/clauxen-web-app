import { withDatabase } from "./db";

export type ConnectorAuditEvent = {
  eventId?: string;
  userId?: string | null;
  workspaceId?: string | null;
  installationId?: string | null;
  connectorKey?: string | null;
  eventType: string;
  toolName?: string | null;
  requestId?: string | null;
  status: "started" | "succeeded" | "failed" | "denied";
  durationMs?: number | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type QueuedConnectorAuditEvent = Required<
  Pick<ConnectorAuditEvent, "eventId" | "eventType" | "status" | "createdAt">
> &
  Omit<
    ConnectorAuditEvent,
    "eventId" | "eventType" | "status" | "createdAt"
  > & {
    type: "audit";
  };

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bounded(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, max)
    : null;
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const encoded = JSON.stringify(value);
  if (encoded.length > 8_192) return { truncated: true };
  return value as Record<string, unknown>;
}

function jsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, jsonValue(item)]),
    );
  }
  return null;
}

function queuedEvent(event: ConnectorAuditEvent): QueuedConnectorAuditEvent {
  return {
    type: "audit",
    eventId: event.eventId ?? crypto.randomUUID(),
    userId: event.userId ?? null,
    workspaceId: event.workspaceId ?? null,
    installationId: event.installationId ?? null,
    connectorKey: event.connectorKey ?? null,
    eventType: event.eventType,
    toolName: event.toolName ?? null,
    requestId: event.requestId ?? null,
    status: event.status,
    durationMs: event.durationMs ?? null,
    errorCode: event.errorCode ?? null,
    metadata: event.metadata ?? {},
    createdAt: event.createdAt ?? new Date().toISOString(),
  };
}

export function enqueueAudit(
  env: Env,
  ctx: ExecutionContext,
  event: ConnectorAuditEvent,
): void {
  ctx.waitUntil(env.CONNECTOR_EVENTS.send(queuedEvent(event)));
}

function parseQueuedEvent(value: unknown): QueuedConnectorAuditEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.type !== "audit" ||
    !uuid(record.eventId) ||
    typeof record.eventType !== "string" ||
    !["started", "succeeded", "failed", "denied"].includes(
      String(record.status),
    )
  ) {
    return null;
  }
  const createdAt = new Date(String(record.createdAt));
  if (!Number.isFinite(createdAt.getTime())) return null;

  return {
    type: "audit",
    eventId: String(record.eventId),
    userId: uuid(record.userId),
    workspaceId: uuid(record.workspaceId),
    installationId: uuid(record.installationId),
    connectorKey: bounded(record.connectorKey, 80),
    eventType: String(record.eventType).slice(0, 120),
    toolName: bounded(record.toolName, 80),
    requestId: bounded(record.requestId, 160),
    status: record.status as QueuedConnectorAuditEvent["status"],
    durationMs:
      typeof record.durationMs === "number" &&
      Number.isFinite(record.durationMs) &&
      record.durationMs >= 0
        ? Math.floor(record.durationMs)
        : null,
    errorCode: bounded(record.errorCode, 160),
    metadata: safeMetadata(record.metadata),
    createdAt: createdAt.toISOString(),
  };
}

export async function consumeConnectorEvents(
  batch: MessageBatch<unknown>,
  env: Env,
): Promise<void> {
  const events: QueuedConnectorAuditEvent[] = [];
  for (const message of batch.messages) {
    const event = parseQueuedEvent(message.body);
    if (!event) {
      message.ack();
      continue;
    }
    events.push(event);
  }
  if (events.length === 0) return;

  const rows: JsonValue = events.map((event) => ({
    event_id: event.eventId,
    user_id: event.userId ?? null,
    workspace_id: event.workspaceId ?? null,
    installation_id: event.installationId ?? null,
    connector_key: event.connectorKey ?? null,
    event_type: event.eventType,
    tool_name: event.toolName ?? null,
    request_id: event.requestId ?? null,
    status: event.status,
    duration_ms: event.durationMs ?? null,
    error_code: event.errorCode ?? null,
    metadata: jsonValue(event.metadata ?? {}),
    created_at: event.createdAt,
  }));

  await withDatabase(env, async (sql) => {
    await sql`
      insert into public.connector_audit_events (
        event_id, user_id, workspace_id, installation_id, connector_key,
        event_type, tool_name, request_id, status, duration_ms, error_code,
        metadata, created_at
      )
      select event_id, user_id, workspace_id, installation_id, connector_key,
             event_type, tool_name, request_id, status, duration_ms, error_code,
             metadata, created_at
      from jsonb_to_recordset(${sql.json(rows)}::jsonb) as event(
        event_id uuid,
        user_id uuid,
        workspace_id uuid,
        installation_id uuid,
        connector_key text,
        event_type text,
        tool_name text,
        request_id text,
        status text,
        duration_ms integer,
        error_code text,
        metadata jsonb,
        created_at timestamptz
      )
      on conflict (event_id) do nothing
    `;
  });
}
