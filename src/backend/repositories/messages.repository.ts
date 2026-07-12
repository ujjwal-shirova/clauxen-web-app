import { query, queryOne } from "@/backend/db/pool"; // parameterized read/write helpers

export type MessageRow = {
  id: string;
  chat_id: string;
  role: string; // user | assistant | system
  content: string | null;
  status: string; // complete | streaming | error | cancelled
  metadata: Record<string, unknown>;
  content_json: Record<string, unknown>;
  created_at: string;
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

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

/** Full history — share/export only. Prefer listMessagesPage for UI. */
export async function listMessagesForChat(chatId: string) {
  return query<MessageRow>(
    `select id, chat_id, role, coalesce(content, '') as content, status, metadata,
            coalesce(content_json, '{}'::jsonb) as content_json, created_at
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
            coalesce(content_json, '{}'::jsonb) as content_json, created_at
     from (
       select id, chat_id, role, content, status, metadata, content_json, created_at
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
}) {
  return queryOne<MessageRow>(
    `insert into public.chat_messages (
       chat_id, user_id, role, content, status, metadata, content_json
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     returning id, chat_id, role, content, status, metadata, content_json, created_at`,
    [
      input.chatId,
      input.userId ?? null,
      input.role,
      input.content,
      input.status ?? "complete",
      JSON.stringify(input.metadata ?? {}),
      JSON.stringify(input.contentJson ?? {}),
    ],
  );
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
    `update public.chat_messages
     set content = $3,
         status = $4,
         content_json = coalesce($5::jsonb, content_json),
         updated_at = now()
     where id = $1 and chat_id = $2
     returning id, chat_id, role, content, status, metadata, content_json, created_at`,
    [
      messageId,
      chatId,
      content,
      status,
      contentJson ? JSON.stringify(contentJson) : null,
    ],
  ); // composite key — message UUID alone insufficient; prevents cross-chat IDOR
}
