import {
  query,
  queryOne,
  withTransaction,
} from "@/backend/db/pool";
import { AppError, notFound } from "@/backend/db/errors";
import type { PoolClient } from "pg";

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
     where chat_id = $1 and status != 'cancelled'
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
    `select id, chat_id, role, content, status, metadata, content_json, created_at, has_more
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
    hasMore && oldest
      ? { id: oldest.id, createdAt: oldest.created_at }
      : null;

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
       where chat_id = $1 and status != 'cancelled'
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
    throw new AppError("Could not start the chat turn.", 500, "chat_turn_failed");
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

    const assistant = await insertIdempotentMessage(client, {
      chatId: input.chatId,
      userId: input.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      contentJson: input.assistantContentJson,
      clientId: input.assistantClientId,
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

/** Mark abandoned streaming rows so reloads don't show empty ghosts. */
export async function finalizeStaleStreamingMessages(
  chatId: string,
  olderThanSeconds = 90,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `with updated as (
       update public.chat_messages
       set status = 'failed',
           content = case
             when coalesce(content, '') = '' then 'Generation interrupted.'
             else content
           end,
           updated_at = now()
       where chat_id = $1
         and status = 'streaming'
         and created_at < now() - make_interval(secs => $2)
       returning id
     )
     select id from updated`,
    [chatId, olderThanSeconds],
  );
  return rows.length;
}
