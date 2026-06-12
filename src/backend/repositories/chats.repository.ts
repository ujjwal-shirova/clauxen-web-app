import { query, queryOne } from "@/backend/db/pool";

export type ChatRow = {
  id: string;
  user_id: string;
  workspace_id: string | null; // enterprise workspace link — optional
  project_id: string | null; // project folder — optional filter
  title: string;
  status: string;
  model_id: string | null; // last selected inference model
  starred: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_LIST_LIMIT = 50; // sidebar default — recent chats window
const MAX_LIST_LIMIT = 100;

export async function listChatsForUser(
  userId: string,
  options?: { projectId?: string; limit?: number },
) {
  const rawLimit = options?.limit ?? DEFAULT_LIST_LIMIT;
  const limit = Math.min(
    MAX_LIST_LIMIT,
    Math.max(
      1,
      Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIST_LIMIT,
    ),
  ); // clamp — negative/NaN/huge values reject
  const params: unknown[] = [userId];
  let sql = `
    select id, user_id, workspace_id, project_id, title, status, model_id, starred, created_at, updated_at
    from public.chats
    where user_id = $1 and status != 'deleted'
  `;

  if (options?.projectId) {
    params.push(options.projectId); // dynamic $n — project scope
    sql += ` and project_id = $${params.length}`;
  }

  params.push(limit);
  sql += ` order by updated_at desc limit $${params.length}`;

  return query<ChatRow>(sql, params);
}

export async function getChatForUser(chatId: string, userId: string) {
  return queryOne<ChatRow>(
    `select id, user_id, workspace_id, project_id, title, status, model_id, starred, created_at, updated_at
     from public.chats where id = $1 and user_id = $2 and status != 'deleted'`,
    [chatId, userId],
  );
}

export async function createChat(input: {
  userId: string;
  title?: string;
  projectId?: string | null;
  workspaceId?: string | null;
}) {
  return queryOne<ChatRow>(
    `insert into public.chats (user_id, project_id, workspace_id, title)
     values ($1, $2, $3, $4)
     returning id, user_id, workspace_id, project_id, title, status, model_id, starred, created_at, updated_at`,
    [
      input.userId,
      input.projectId ?? null, // unset → SQL NULL — unassigned project
      input.workspaceId ?? null,
      input.title ?? "New chat",
    ],
  );
}

export async function updateChat(
  chatId: string,
  userId: string,
  patch: { title?: string; starred?: boolean; projectId?: string | null },
) {
  return queryOne<ChatRow>(
    `update public.chats set
       title = coalesce($3, title),
       starred = coalesce($4, starred),
       project_id = coalesce($5, project_id),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning id, user_id, workspace_id, project_id, title, status, model_id, starred, created_at, updated_at`,
    [
      chatId,
      userId,
      patch.title ?? null, // null → coalesce skip — field unchanged
      patch.starred ?? null,
      patch.projectId ?? null,
    ],
  );
}

export async function deleteChat(chatId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.chats set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 returning id`,
    [chatId, userId], // owner mismatch → zero rows, id undefined
  );
}
