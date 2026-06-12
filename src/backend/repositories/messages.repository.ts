import { query, queryOne } from "@/backend/db/pool"; // parameterized read/write helpers

export type MessageRow = {
  id: string;
  chat_id: string;
  role: string; // user | assistant | system
  content: string | null;
  status: string; // complete | streaming | error | cancelled
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listMessagesForChat(chatId: string) {
  return query<MessageRow>(
    `select id, chat_id, role, coalesce(content, '') as content, status, metadata, created_at
     from public.chat_messages
     where chat_id = $1 and status != 'cancelled'
     order by created_at asc`,
    [chatId],
  );
}

export async function createMessage(input: {
  chatId: string;
  userId?: string | null;
  role: string;
  content: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  return queryOne<MessageRow>(
    `insert into public.chat_messages (chat_id, user_id, role, content, status, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     returning id, chat_id, role, content, status, metadata, created_at`,
    [
      input.chatId,
      input.userId ?? null,
      input.role,
      input.content,
      input.status ?? "complete",
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function updateMessageContent(
  messageId: string,
  chatId: string,
  content: string,
  status = "complete",
) {
  return queryOne<MessageRow>(
    `update public.chat_messages
     set content = $3, status = $4, updated_at = now()
     where id = $1 and chat_id = $2
     returning id, chat_id, role, content, status, metadata, created_at`,
    [messageId, chatId, content, status],
  ); // composite key — message UUID alone insufficient; prevents cross-chat IDOR
}
