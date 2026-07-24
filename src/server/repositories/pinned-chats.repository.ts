import { query, queryOne } from "@/server/db/pool";

export type PinnedChatRow = {
  id: string;
  chat_id: string;
  user_id: string;
  position: number;
  created_at: string;
};

export async function listPinnedChats(userId: string) {
  return query<PinnedChatRow>(
    `select id, chat_id, user_id, position, created_at
     from public.pinned_chats
     where user_id = $1
     order by position asc, created_at asc`,
    [userId],
  );
}

export async function getPinnedChat(chatId: string, userId: string) {
  return queryOne<PinnedChatRow>(
    `select id, chat_id, user_id, position, created_at
     from public.pinned_chats
     where chat_id = $1 and user_id = $2`,
    [chatId, userId],
  );
}

export async function pinChat(chatId: string, userId: string) {
  const maxPosition = await queryOne<{ max: number | null }>(
    `select max(position) as max from public.pinned_chats where user_id = $1`,
    [userId],
  );
  const position = (maxPosition?.max ?? -1) + 1;

  return queryOne<PinnedChatRow>(
    `insert into public.pinned_chats (chat_id, user_id, position)
     values ($1, $2, $3)
     on conflict (chat_id, user_id) do update set position = excluded.position
     returning id, chat_id, user_id, position, created_at`,
    [chatId, userId, position],
  );
}

export async function unpinChat(chatId: string, userId: string) {
  return queryOne<{ id: string }>(
    `delete from public.pinned_chats
     where chat_id = $1 and user_id = $2
     returning id`,
    [chatId, userId],
  );
}
