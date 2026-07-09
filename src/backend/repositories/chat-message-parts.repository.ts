import { query, queryOne } from "@/backend/db/pool";

export async function attachFilePartsToMessage(
  messageId: string,
  fileIds: string[],
  userId: string,
) {
  if (!fileIds.length) return [];

  const rows = await query<{ id: string }>(
    `insert into public.chat_message_parts (message_id, type, file_id, position)
     select $1, 'file', uf.id, row_number() over () - 1
     from public.user_files uf
     where uf.id = any($2::uuid[]) and uf.user_id = $3 and uf.status != 'deleted'
     returning id`,
    [messageId, fileIds, userId],
  );

  return rows;
}

export async function listFilePartsForMessage(messageId: string) {
  return query<{
    id: string;
    file_id: string | null;
    position: number;
  }>(
    `select id, file_id, position
     from public.chat_message_parts
     where message_id = $1 and type = 'file'
     order by position asc`,
    [messageId],
  );
}
