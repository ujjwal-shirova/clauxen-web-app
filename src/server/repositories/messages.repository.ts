import { query, queryOne, withTransaction } from "@/server/db/pool";
import { AppError, notFound } from "@/server/db/errors";
import type { PoolClient } from "pg";
import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptRecord,
} from "@/server/training/transcript-format";

export type MessageRow = {
  id: string;
  chat_id: string;
  role: string; // user | assistant | system
  content: string | null;
  status: string; // complete | streaming | failed | cancelled
  metadata: Record<string, unknown>;
  content_json: Record<string, unknown>;
  created_at: string;
  client_id?: string | null;
};

export type MessagePageCursor = {
  id: string;
  createdAt: string;
};

export type MessagePageResult = {
  messages: MessageRow[];
  nextCursor: MessagePageCursor | null;
  hasMore: boolean;
};

type PageRpcRow = MessageRow & { has_more: boolean };

const DEFAULT_PAGE_LIMIT = 500;
const MAX_PAGE_LIMIT = 500;

/** Full history — share/export only. Prefer listMessagesPage for UI. */
export async function listMessagesForChat(chatId: string) {
  return query<MessageRow>(
    `select id, chat_id, role, coalesce(content, '') as content, status, metadata,
            coalesce(content_json, '{}'::jsonb) as content_json, created_at, client_id
     from public.chat_messages
     where chat_id = $1
       and (status != 'cancelled' or coalesce(trim(content), '') != '')
     order by created_at asc, id asc`,
    [chatId],
  );
}

/**
 * Keyset page via fetch_chat_messages_page RPC.
 * First page (no cursor) = newest N messages, returned chronological ASC.
 * Older pages: rows strictly older than (cursorCreatedAt, cursorId).
 */
export async function listMessagesPage(input: {
  chatId: string;
  userId: string;
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit?: number;
}): Promise<MessagePageResult> {
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, input.limit ?? DEFAULT_PAGE_LIMIT),
  );
  const rows = await query<PageRpcRow>(
    `select id, chat_id, role, content, status, metadata, content_json, created_at,
            client_id, has_more
     from public.fetch_chat_messages_page($1, $2::uuid, $3::timestamptz, $4::uuid, $5)`,
    [
      input.chatId,
      input.userId,
      input.cursorCreatedAt ?? null,
      input.cursorId ?? null,
      limit,
    ],
  );

  const messages: MessageRow[] = rows.map(
    ({ has_more: _hasMore, ...message }) => message,
  );
  const hasMore = rows.some((row) => row.has_more) || false;
  const oldest = messages[0];
  const nextCursor =
    hasMore && oldest ? { id: oldest.id, createdAt: oldest.created_at } : null;

  return { messages, nextCursor, hasMore };
}

/** Newest N messages chronological ASC — model prompt / inference. */
export async function listRecentMessagesForChat(
  chatId: string,
  limit = 40,
): Promise<MessageRow[]> {
  const safeLimit = Math.min(MAX_PAGE_LIMIT * 2, Math.max(1, limit));
  return query<MessageRow>(
    `select id, chat_id, role, coalesce(content, '') as content, status, metadata,
            coalesce(content_json, '{}'::jsonb) as content_json, created_at, client_id
     from (
       select id, chat_id, role, content, status, metadata, content_json, created_at, client_id
       from public.chat_messages
       where chat_id = $1
         and (status != 'cancelled' or coalesce(trim(content), '') != '')
       order by created_at desc, id desc
       limit $2
     ) recent
     order by created_at asc, id asc`,
    [chatId, safeLimit],
  );
}

export async function createMessage(input: {
  chatId: string;
  userId?: string | null;
  role: string;
  content: string;
  status?: string;
  metadata?: Record<string, unknown>;
  contentJson?: Record<string, unknown>;
  clientId?: string | null;
}) {
  return queryOne<MessageRow>(
    `with inserted as (
       insert into public.chat_messages (
         chat_id, user_id, role, content, status, metadata, content_json, client_id
       )
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       returning id, chat_id, role, content, status, metadata, content_json, created_at, client_id
     ),
     touch as (
       update public.chats
       set updated_at = now()
       where id = $1
       returning id
     )
     select id, chat_id, role, content, status, metadata, content_json, created_at, client_id
     from inserted`,
    [
      input.chatId,
      input.userId ?? null,
      input.role,
      input.content,
      input.status ?? "complete",
      JSON.stringify(input.metadata ?? {}),
      JSON.stringify(input.contentJson ?? {}),
      input.clientId ?? null,
    ],
  );
}

type InsertedMessageRow = MessageRow & { inserted: boolean };

export type MessageTranscriptLine = {
  role: "user" | "assistant" | "system" | "tool" | "meta";
  record: TranscriptRecord;
  trainingEligible?: boolean;
};

export type DurableToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
};

async function upsertMessageTranscriptLines(
  client: PoolClient,
  input: {
    chatId: string;
    userId: string;
    messageId: string;
    lines: MessageTranscriptLine[];
  },
): Promise<void> {
  if (input.lines.length === 0) return;
  const payload = input.lines.map((line) => ({
    role: line.role,
    record: line.record,
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    training_eligible: line.trainingEligible ?? true,
  }));
  await client.query(
    `with next_seq as (
       select coalesce(max(seq), 0) as base
       from public.chat_transcript_lines
       where chat_id = $1
     )
     insert into public.chat_transcript_lines (
       chat_id, user_id, message_id, seq, role, record, schema_version,
       training_eligible
     )
     select
       $1,
       $2::uuid,
       $3::uuid,
       next_seq.base + line.ordinality::integer,
       line.value->>'role',
       line.value->'record',
       coalesce(nullif(line.value->>'schema_version', ''), $5),
       coalesce((line.value->>'training_eligible')::boolean, true)
     from jsonb_array_elements($4::jsonb) with ordinality as line(value, ordinality)
     cross join next_seq
     on conflict (message_id, role) where message_id is not null
     do update set
       record = excluded.record,
       schema_version = excluded.schema_version,
       training_eligible = excluded.training_eligible`,
    [
      input.chatId,
      input.userId,
      input.messageId,
      JSON.stringify(payload),
      TRANSCRIPT_SCHEMA_VERSION,
    ],
  );
}

async function insertIdempotentMessage(
  client: PoolClient,
  input: {
    chatId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    status: string;
    metadata?: Record<string, unknown>;
    contentJson?: Record<string, unknown>;
    clientId: string;
  },
): Promise<InsertedMessageRow> {
  const result = await client.query<InsertedMessageRow>(
    `insert into public.chat_messages (
       chat_id, user_id, role, content, status, metadata, content_json, client_id
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     on conflict (chat_id, client_id) where client_id is not null
     do update set client_id = public.chat_messages.client_id
     returning id, chat_id, role, content, status, metadata, content_json, created_at,
               client_id, (xmax = 0) as inserted`,
    [
      input.chatId,
      input.userId,
      input.role,
      input.content,
      input.status,
      JSON.stringify(input.metadata ?? {}),
      JSON.stringify(input.contentJson ?? {}),
      input.clientId,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      "Could not start the chat turn.",
      500,
      "chat_turn_failed",
    );
  }
  if (row.role !== input.role) {
    throw new AppError(
      "The request id was already used for a different message.",
      409,
      "idempotency_conflict",
    );
  }
  return row;
}

async function attachFilePartsInTransaction(
  client: PoolClient,
  messageId: string,
  fileIds: string[],
  userId: string,
) {
  if (fileIds.length === 0) return;
  await client.query(
    `insert into public.chat_message_parts (message_id, type, file_id, position)
     select $1, 'file', uf.id, row_number() over () - 1
     from public.user_files uf
     where uf.id = any($2::uuid[])
       and uf.user_id = $3
       and uf.status != 'deleted'`,
    [messageId, fileIds, userId],
  );
}

/**
 * Atomically reserve exactly one user/assistant pair for a client turn.
 * Retrying the same request returns the original rows instead of duplicating
 * optimistic messages or cancelling an already-running generation.
 */
export async function beginChatTurn(input: {
  chatId: string;
  userId: string;
  userContent: string;
  userMetadata?: Record<string, unknown>;
  userContentJson?: Record<string, unknown>;
  fileIds?: string[];
  userClientId: string;
  assistantClientId: string;
  assistantContentJson?: Record<string, unknown>;
  assistantStatus?: "queued" | "streaming";
}): Promise<{
  user: InsertedMessageRow;
  assistant: InsertedMessageRow;
}> {
  return withTransaction(async (client) => {
    const ownedChat = await client.query<{ id: string }>(
      `select id
       from public.chats
       where id = $1 and user_id = $2 and status != 'deleted'
       for key share`,
      [input.chatId, input.userId],
    );
    if (!ownedChat.rows[0]) throw notFound("Chat not found.");

    const user = await insertIdempotentMessage(client, {
      chatId: input.chatId,
      userId: input.userId,
      role: "user",
      content: input.userContent,
      status: "complete",
      metadata: input.userMetadata,
      contentJson: input.userContentJson,
      clientId: input.userClientId,
    });

    if (user.inserted && input.fileIds?.length) {
      await attachFilePartsInTransaction(
        client,
        user.id,
        input.fileIds,
        input.userId,
      );
    }

    let assistant = await insertIdempotentMessage(client, {
      chatId: input.chatId,
      userId: input.userId,
      role: "assistant",
      content: "",
      status: input.assistantStatus ?? "streaming",
      contentJson: input.assistantContentJson,
      clientId: input.assistantClientId,
    });

    // The global generation lease is acquired before this transaction. If the
    // same client turn exists but is not complete, its prior holder is gone and
    // this request may safely resume the durable assistant row in place.
    if (
      !assistant.inserted &&
      input.assistantStatus !== "queued" &&
      assistant.status !== "complete"
    ) {
      const recovered = await client.query<InsertedMessageRow>(
        `update public.chat_messages
         set content = '',
             status = 'streaming',
             content_json = $3::jsonb,
             updated_at = now()
         where id = $1 and chat_id = $2 and role = 'assistant'
         returning id, chat_id, role, content, status, metadata, content_json,
                   created_at, client_id, true as inserted`,
        [
          assistant.id,
          input.chatId,
          JSON.stringify(input.assistantContentJson ?? {}),
        ],
      );
      if (recovered.rows[0]) assistant = recovered.rows[0];
    }

    // The user row and its training/export line commit together. Repeating a
    // client turn repairs a missing line through the message/role unique key.
    await upsertMessageTranscriptLines(client, {
      chatId: input.chatId,
      userId: input.userId,
      messageId: user.id,
      lines: [
        {
          role: "user",
          record: (input.userContentJson as TranscriptRecord | undefined) ?? {
            role: "user",
            message: { content: [{ type: "text", text: input.userContent }] },
          },
        },
      ],
    });

    if (user.inserted || assistant.inserted) {
      await client.query(
        `update public.chats
         set updated_at = now()
         where id = $1`,
        [input.chatId],
      );
    }

    return { user, assistant };
  });
}

/** Create a standalone user message and transcript line in one transaction. */
export async function createUserMessageWithTranscript(input: {
  chatId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
  contentJson: TranscriptRecord;
  fileIds?: string[];
}) {
  return withTransaction(async (client) => {
    const ownedChat = await client.query<{ id: string }>(
      `select id from public.chats
       where id = $1 and user_id = $2 and status != 'deleted'
       for update`,
      [input.chatId, input.userId],
    );
    if (!ownedChat.rows[0]) throw notFound("Chat not found.");

    const inserted = await client.query<MessageRow>(
      `insert into public.chat_messages (
         chat_id, user_id, role, content, status, metadata, content_json
       ) values ($1, $2, 'user', $3, 'complete', $4::jsonb, $5::jsonb)
       returning id, chat_id, role, content, status, metadata, content_json,
                 created_at, client_id`,
      [
        input.chatId,
        input.userId,
        input.content,
        JSON.stringify(input.metadata ?? {}),
        JSON.stringify(input.contentJson),
      ],
    );
    const message = inserted.rows[0];
    if (!message) {
      throw new AppError(
        "Could not save the user message.",
        500,
        "message_failed",
      );
    }
    await attachFilePartsInTransaction(
      client,
      message.id,
      input.fileIds ?? [],
      input.userId,
    );
    await upsertMessageTranscriptLines(client, {
      chatId: input.chatId,
      userId: input.userId,
      messageId: message.id,
      lines: [{ role: "user", record: input.contentJson }],
    });
    await client.query(
      `update public.chats set updated_at = now() where id = $1`,
      [input.chatId],
    );
    return message;
  });
}

/** Final assistant payload + complete agent timeline + JSONL lines, atomically. */
export async function finalizeAssistantTurn(input: {
  messageId: string;
  chatId: string;
  userId: string;
  content: string;
  status: "complete" | "failed" | "cancelled";
  contentJson: TranscriptRecord;
  transcriptLines: MessageTranscriptLine[];
  tools?: DurableToolCall[];
}) {
  return withTransaction(async (client) => {
    const ownedChat = await client.query<{ id: string }>(
      `select id from public.chats
       where id = $1 and user_id = $2 and status != 'deleted'
       for update`,
      [input.chatId, input.userId],
    );
    if (!ownedChat.rows[0]) throw notFound("Chat not found.");

    const updated = await client.query<MessageRow>(
      `update public.chat_messages
       set content = $4,
           status = $5,
           content_json = $6::jsonb,
           updated_at = now()
       where id = $1 and chat_id = $2 and user_id = $3 and role = 'assistant'
       returning id, chat_id, role, content, status, metadata, content_json,
                 created_at, client_id`,
      [
        input.messageId,
        input.chatId,
        input.userId,
        input.content,
        input.status,
        JSON.stringify(input.contentJson),
      ],
    );
    const message = updated.rows[0];
    if (!message) throw notFound("Assistant message not found.");

    await upsertMessageTranscriptLines(client, {
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      lines: input.transcriptLines,
    });
    if (input.tools?.length) {
      const toolPayload = input.tools.map((tool) => ({
        provider_call_id: tool.id,
        tool_name: tool.name,
        input: tool.input ?? {},
        output: tool.result === undefined ? null : { content: tool.result },
        status:
          input.status === "cancelled" && tool.result === undefined
            ? "cancelled"
            : tool.isError
              ? "failed"
              : tool.result === undefined
                ? "failed"
                : "complete",
        error: tool.isError ? { message: tool.result ?? "Tool failed." } : null,
        latency_ms:
          typeof tool.startedAtMs === "number" &&
          typeof tool.completedAtMs === "number"
            ? Math.max(0, tool.completedAtMs - tool.startedAtMs)
            : null,
        started_at_ms: tool.startedAtMs ?? null,
      }));
      await client.query(
        `insert into public.tool_calls (
           user_id, workspace_id, chat_id, message_id, provider_call_id,
           tool_name, provider, input, output, status, error, latency_ms,
           created_at
         )
         select
           $1::uuid,
           c.workspace_id,
           $2,
           $3::uuid,
           tool.value->>'provider_call_id',
           tool.value->>'tool_name',
           'clauxen-agent',
           coalesce(tool.value->'input', '{}'::jsonb),
           tool.value->'output',
           tool.value->>'status',
           tool.value->'error',
           nullif(tool.value->>'latency_ms', '')::integer,
           coalesce(
             to_timestamp(nullif(tool.value->>'started_at_ms', '')::double precision / 1000),
             now()
           )
         from public.chats c
         cross join jsonb_array_elements($4::jsonb) as tool(value)
         where c.id = $2 and c.user_id = $1
         on conflict (message_id, provider_call_id)
           where message_id is not null and provider_call_id is not null
         do update set
           tool_name = excluded.tool_name,
           input = excluded.input,
           output = excluded.output,
           status = excluded.status,
           error = excluded.error,
           latency_ms = excluded.latency_ms`,
        [
          input.userId,
          input.chatId,
          input.messageId,
          JSON.stringify(toolPayload),
        ],
      );
    }
    await client.query(
      `update public.chats set updated_at = now() where id = $1`,
      [input.chatId],
    );
    return message;
  });
}

export type ChatSearchHit = {
  message_id: string;
  chat_id: string;
  title: string;
  role: string;
  content: string;
  created_at: string;
  rank: number;
};

export async function searchMessagesForUser(
  userId: string,
  queryText: string,
  limit = 20,
) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  return query<ChatSearchHit>(
    `select
       m.id as message_id,
       m.chat_id,
       c.title,
       m.role,
       coalesce(m.content, '') as content,
       m.created_at,
       ts_rank(
         coalesce(m.content_search, to_tsvector('simple', coalesce(m.content, ''))),
         plainto_tsquery('simple', $2)
       ) as rank
     from public.chat_messages m
     join public.chats c on c.id = m.chat_id
     where c.user_id = $1
       and c.status != 'deleted'
       and m.content is not null
       and coalesce(m.content_search, to_tsvector('simple', coalesce(m.content, '')))
           @@ plainto_tsquery('simple', $2)
     order by rank desc, m.created_at desc
     limit $3`,
    [userId, queryText, safeLimit],
  );
}

export async function updateMessageContent(
  messageId: string,
  chatId: string,
  content: string,
  status = "complete",
  contentJson?: Record<string, unknown>,
) {
  return queryOne<MessageRow>(
    `with updated as (
       update public.chat_messages
       set content = $3,
           status = $4,
           content_json = coalesce($5::jsonb, content_json),
           updated_at = now()
       where id = $1 and chat_id = $2
       returning id, chat_id, role, content, status, metadata, content_json, created_at
     ),
     touch as (
       update public.chats
       set updated_at = now()
       where id = $2
       returning id
     )
     select id, chat_id, role, content, status, metadata, content_json, created_at
     from updated`,
    [
      messageId,
      chatId,
      content,
      status,
      contentJson ? JSON.stringify(contentJson) : null,
    ],
  ); // composite key — message UUID alone insufficient; prevents cross-chat IDOR
}

/** Purge all messages for a chat after an R2 archive/delete snapshot. */
export async function deleteMessagesForChat(chatId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `with deleted as (
       delete from public.chat_messages
       where chat_id = $1
       returning id
     )
     select id from deleted`,
    [chatId],
  );
  return rows.length;
}

/**
 * Replace live messages with an R2 archive snapshot (unarchive path).
 * Deletes any residual rows first, then reinserts with original ids/timestamps.
 */
export async function replaceMessagesFromSnapshot(input: {
  chatId: string;
  userId: string;
  messages: Array<Record<string, unknown>>;
}): Promise<number> {
  await deleteMessagesForChat(input.chatId);
  if (!input.messages.length) return 0;

  let inserted = 0;
  for (const raw of input.messages) {
    const id = typeof raw.id === "string" ? raw.id : null;
    const role = typeof raw.role === "string" ? raw.role : null;
    if (!id || !role) continue;
    const content =
      typeof raw.content === "string"
        ? raw.content
        : raw.content == null
          ? ""
          : String(raw.content);
    const status =
      typeof raw.status === "string" && raw.status.trim()
        ? raw.status
        : "complete";
    const metadata =
      raw.metadata && typeof raw.metadata === "object"
        ? (raw.metadata as Record<string, unknown>)
        : {};
    const contentJson =
      raw.content_json && typeof raw.content_json === "object"
        ? (raw.content_json as Record<string, unknown>)
        : {};
    const clientId = typeof raw.client_id === "string" ? raw.client_id : null;
    const createdAt =
      typeof raw.created_at === "string" ? raw.created_at : null;

    await queryOne(
      `insert into public.chat_messages (
         id, chat_id, user_id, role, content, status, metadata, content_json,
         client_id, created_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9,
         coalesce($10::timestamptz, now())
       )
       on conflict (id) do update set
         content = excluded.content,
         status = excluded.status,
         metadata = excluded.metadata,
         content_json = excluded.content_json,
         client_id = coalesce(excluded.client_id, public.chat_messages.client_id)`,
      [
        id,
        input.chatId,
        input.userId,
        role,
        content,
        status,
        JSON.stringify(metadata),
        JSON.stringify(contentJson),
        clientId,
        createdAt,
      ],
    );
    inserted += 1;
  }
  return inserted;
}

type StaleStreamingRow = {
  id: string;
  content: string | null;
  content_json: Record<string, unknown>;
  created_at: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

/**
 * Settle an abandoned stream's persisted timeline so a reload renders the
 * real "Worked for Ns" / tool history instead of a synthetic estimate.
 * The end stamp is the latest honestly-observed progress (never wall-clock
 * now, which would inflate to hours when a chat reopens much later).
 */
function settleAbandonedContentJson(
  contentJson: Record<string, unknown>,
  createdAtMs: number,
  failed: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...contentJson };
  const agentUi = asRecord(next.agent_ui) ?? {};
  const uiNext: Record<string, unknown> = { ...agentUi };
  const segments = Array.isArray(uiNext.segments)
    ? [...(uiNext.segments as unknown[])]
    : [];
  let latestEnd = 0;
  const settledSegments = segments.map((raw) => {
    const seg = asRecord(raw);
    if (!seg) return raw;
    const segNext: Record<string, unknown> = { ...seg };
    const segEnd = asMs(segNext.completedAtMs);
    if (segEnd) {
      latestEnd = Math.max(latestEnd, segEnd);
      return segNext;
    }
    // Live-at-abandon segments close at the best-known end below; running
    // tools are honest failures, not completions.
    if (segNext.type === "tool" && segNext.status === "running") {
      segNext.status = failed ? "cancelled" : "error";
    }
    return segNext;
  });
  const uiStart = asMs(uiNext.startedAtMs) ?? createdAtMs;
  const existingEnd = asMs(uiNext.completedAtMs);
  const end =
    existingEnd && existingEnd >= uiStart
      ? existingEnd
      : Math.max(latestEnd, uiStart, createdAtMs);
  const finalSegments = settledSegments.map((raw) => {
    const seg = asRecord(raw);
    if (!seg) return raw;
    const segNext: Record<string, unknown> = { ...seg };
    if (!asMs(segNext.completedAtMs)) segNext.completedAtMs = end;
    if (segNext.type === "thinking" && segNext.durationSeconds == null) {
      const segStart = asMs(segNext.startedAtMs) ?? uiStart;
      segNext.durationSeconds = Math.max(
        1,
        Math.round((end - segStart) / 1000),
      );
    }
    return segNext;
  });
  if (finalSegments.length > 0) uiNext.segments = finalSegments;
  if (!asMs(uiNext.startedAtMs)) uiNext.startedAtMs = createdAtMs;
  uiNext.completedAtMs = end;
  uiNext.status = failed ? "failed" : "complete";
  next.agent_ui = uiNext;
  return next;
}

/** Mark abandoned streaming rows so reloads don't show empty ghosts. */
export async function finalizeStaleStreamingMessages(
  chatId: string,
  olderThanSeconds = 90,
): Promise<number> {
  const stale = await query<StaleStreamingRow>(
    `select id, content, coalesce(content_json, '{}'::jsonb) as content_json,
            created_at
     from public.chat_messages
     where chat_id = $1
       and status = 'streaming'
       and created_at < now() - make_interval(secs => $2)
     limit 25`,
    [chatId, olderThanSeconds],
  );
  if (stale.length === 0) return 0;
  let settled = 0;
  for (const row of stale) {
    const failed = (row.content ?? "").trim().length === 0;
    const createdAtMs = Number.isNaN(new Date(row.created_at).getTime())
      ? Date.now()
      : new Date(row.created_at).getTime();
    const contentJson = asRecord(row.content_json) ?? {};
    try {
      await query(
        `update public.chat_messages
         set status = $3,
             content_json = $4::jsonb,
             updated_at = now()
         where id = $1 and chat_id = $2 and status = 'streaming'`,
        [
          row.id,
          chatId,
          failed ? "failed" : "complete",
          JSON.stringify(
            settleAbandonedContentJson(contentJson, createdAtMs, failed),
          ),
        ],
      );
      settled += 1;
    } catch {
      // Best-effort sweep — a concurrent finalize owns the row.
    }
  }
  return settled;
}
