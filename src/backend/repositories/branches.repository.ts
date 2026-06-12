import { queryOne } from "@/backend/db/pool"; // single-row parameterized SQL helper

export async function getBranchState(chatId: string, userId: string) {
  return queryOne<{
    chat_id: string;
    active_path: unknown;
    messages: unknown; // JSON tree — forked/alternate message nodes
    updated_at: string;
  }>(
    `select chat_id, active_path, messages, updated_at
     from public.chat_branch_states
     where chat_id = $1 and user_id = $2`,
    [chatId, userId],
  );
}

export async function upsertBranchState(input: {
  chatId: string;
  userId: string;
  activePath: unknown;
  messages: unknown;
}) {
  return queryOne<{ chat_id: string; updated_at: string }>(
    `insert into public.chat_branch_states (chat_id, user_id, active_path, messages)
     select $1, $2, $3::jsonb, $4::jsonb
     where exists (
       select 1 from public.chats
       where id = $1 and user_id = $2 and status != 'deleted'
     )
     on conflict (chat_id) do update set
       active_path = excluded.active_path,
       messages = excluded.messages,
       updated_at = now()
     where chat_branch_states.user_id = excluded.user_id
     returning chat_id, updated_at`,
    [
      input.chatId,
      input.userId,
      JSON.stringify(input.activePath ?? []),
      JSON.stringify(input.messages ?? []), // undefined → empty messages tree
    ],
  );
}
