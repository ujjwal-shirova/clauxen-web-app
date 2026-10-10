import { query, queryOne } from "@/server/db/pool";
import { AppError } from "@/server/db/errors";
import { generateChatId } from "@/lib/chat-id";

export type ChatRow = {
  id: string;
  user_id: string;
  workspace_id: string | null; // enterprise workspace link — optional
  title: string;
  status: string;
  model_id: string | null; // last selected inference model
  starred: boolean;
  created_at: string;
  updated_at: string;
  generating?: boolean;
};

const DEFAULT_LIST_LIMIT = 50; // sidebar default — recent chats window
const MAX_LIST_LIMIT = 100;

export async function chatIdExists(chatId: string): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `select public.chat_id_exists($1) as exists`,
    [chatId],
  );
  return Boolean(row?.exists);
}

export async function allocateUniqueChatId(
  existingHints?: Iterable<string>,
): Promise<string> {
  const hints = existingHints ? new Set(existingHints) : new Set<string>();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const id = generateChatId(hints);
    hints.add(id);
    if (!(await chatIdExists(id))) return id;
  }
  // Extremely unlikely — timestamp suffix forces uniqueness.
  return `${generateChatId()}-${Date.now().toString(36)}`;
}

export async function listChatsForUser(
  userId: string,
  options?: { limit?: number },
) {
  const rawLimit = options?.limit ?? DEFAULT_LIST_LIMIT;
  const limit = Math.min(
    MAX_LIST_LIMIT,
    Math.max(
      1,
      Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIST_LIMIT,
    ),
  ); // clamp — negative/NaN/huge values reject

  return query<ChatRow>(
    `select id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at,
       (
         coalesce(metadata->>'generating', '') = 'true'
         and nullif(metadata->>'generating_at', '')::timestamptz > now() - interval '45 minutes'
       ) as generating
     from public.chats
     where user_id = $1 and status != 'deleted'
     order by updated_at desc limit $2`,
    [userId, limit],
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Title search across the user's chats. Empty query returns the recent window. */
export async function searchChatsForUser(
  userId: string,
  rawQuery: string,
  options?: { limit?: number },
) {
  const queryText = rawQuery.trim().slice(0, 80);
  const rawLimit = options?.limit ?? 40;
  const limit = Math.min(
    MAX_LIST_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 40),
  );
  if (!queryText) {
    return listChatsForUser(userId, { limit });
  }
  return query<ChatRow>(
    `select id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at
     from public.chats
     where user_id = $1
       and status != 'deleted'
       and title ilike $2 escape '\\'
     order by updated_at desc
     limit $3`,
    [userId, `%${escapeLike(queryText)}%`, limit],
  );
}

export async function getChatForUser(chatId: string, userId: string) {
  return queryOne<ChatRow>(
    `select id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at
     from public.chats where id = $1 and user_id = $2 and status != 'deleted'`,
    [chatId, userId],
  );
}

/** Owner-scoped read that still sees deleted rows (archive snapshot / restore). */
export async function getChatForUserIncludingDeleted(
  chatId: string,
  userId: string,
) {
  return queryOne<ChatRow>(
    `select id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at
     from public.chats where id = $1 and user_id = $2`,
    [chatId, userId],
  );
}

export async function createChat(input: {
  userId: string;
  title?: string;
  workspaceId?: string | null;
  id?: string;
}) {
  const id = input.id ?? (await allocateUniqueChatId());
  return queryOne<ChatRow>(
    `insert into public.chats (id, user_id, workspace_id, title)
     values ($1, $2, $3, $4)
     returning id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at`,
    [id, input.userId, input.workspaceId ?? null, input.title ?? "New chat"],
  );
}

/** Insert with workspace from profiles; retry only an extremely rare id collision. */
export async function createChatFast(input: {
  userId: string;
  title?: string;
  id?: string;
  projectId?: string | null;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = input.id ?? generateChatId();
    try {
      return await queryOne<ChatRow>(
        `insert into public.chats (id, user_id, workspace_id, title, project_id)
         select
           $1,
           $2,
           (select default_workspace_id from public.profiles where id = $2 limit 1),
           $3,
           $4
         returning id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at`,
        [id, input.userId, input.title ?? "New chat", input.projectId ?? null],
      );
    } catch (error) {
      if (
        input.id ||
        !(error instanceof AppError) ||
        error.code !== "conflict" ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }
  return null;
}

export async function setChatGenerating(
  chatId: string,
  userId: string,
  generating: boolean,
) {
  await query(
    `update public.chats
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'generating', $3::boolean,
       'generating_at', case when $3::boolean then to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else '' end
     )
     where id = $1 and user_id = $2`,
    [chatId, userId, generating],
  );
}

/**
 * Drop a generating mark once the assistant turn is already saved.
 * A late heartbeat used to leave the flag on after finalize, so reopening
 * the app kept the composer stop button and the sidebar spinner spinning.
 */
export async function settleFinishedGenerations(
  userId: string,
  chatId?: string | null,
) {
  await query(
    `update public.chat_messages m
     set status = case
           when m.content_json->'agent_ui'->>'status' in ('failed', 'cancelled')
             then m.content_json->'agent_ui'->>'status'
           else 'complete'
         end,
         updated_at = now()
     where m.role = 'assistant'
       and m.status in ('queued', 'streaming')
       and m.content_json->'agent_ui'->>'status' in ('complete', 'failed', 'cancelled')
       and m.chat_id in (
         select c.id
         from public.chats c
         where c.user_id = $1
           and c.status != 'deleted'
           and ($2::text is null or c.id = $2)
       )`,
    [userId, chatId ?? null],
  );

  await query(
    `update public.chats c
     set metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
       'generating', false,
       'generating_at', ''
     )
     where c.user_id = $1
       and ($2::text is null or c.id = $2)
       and c.status != 'deleted'
       and coalesce(c.metadata->>'generating', '') = 'true'
       and not exists (
         select 1
         from public.chat_messages m
         where m.chat_id = c.id
           and m.role = 'assistant'
           and m.status in ('queued', 'streaming')
       )
       and (
         exists (
           select 1
           from public.chat_messages m
           where m.chat_id = c.id
             and m.role = 'assistant'
             and m.status in ('complete', 'failed', 'cancelled')
         )
         or coalesce(
           nullif(c.metadata->>'generating_at', '')::timestamptz,
           '-infinity'::timestamptz
         ) < now() - interval '3 minutes'
       )`,
    [userId, chatId ?? null],
  );
}

export async function listGeneratingChatIds(userId: string) {
  try {
    await settleFinishedGenerations(userId);
  } catch (error) {
    console.warn("[chats] could not settle finished generations", error);
  }
  const rows = await query<{ id: string }>(
    `select c.id from public.chats c
     where c.user_id = $1 and c.status != 'deleted'
       and (exists (select 1 from public.chat_generation_jobs j
         where j.chat_id = c.id and j.user_id = $1
           and j.status in ('queued', 'running', 'continuing'))
       or (coalesce(c.metadata->>'generating', '') = 'true'
         and nullif(c.metadata->>'generating_at', '')::timestamptz > now() - interval '45 minutes'))`,
    [userId],
  );
  return rows.map((row) => row.id);
}

export async function updateChat(
  chatId: string,
  userId: string,
  patch: { title?: string; starred?: boolean },
) {
  return queryOne<ChatRow>(
    `update public.chats set
       title = coalesce($3, title),
       starred = coalesce($4, starred),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at`,
    [
      chatId,
      userId,
      patch.title ?? null, // null → coalesce skip — field unchanged
      patch.starred ?? null,
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

/** Soft-archive (user action). Row stays queryable for restore; sidebar filters it. */
export async function archiveChat(chatId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.chats set status = 'archived', archived_at = coalesce(archived_at, now()), updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted' returning id`,
    [chatId, userId],
  );
}

/** Reactivate an archived chat after a successful R2 restore (or best-effort). */
export async function restoreChat(
  chatId: string,
  userId: string,
  patch?: { title?: string },
) {
  return queryOne<ChatRow>(
    `update public.chats set
       status = 'active',
       archived_at = null,
       title = coalesce($3, title),
       updated_at = now()
     where id = $1 and user_id = $2 and status = 'archived'
     returning id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at`,
    [chatId, userId, patch?.title ?? null],
  );
}
