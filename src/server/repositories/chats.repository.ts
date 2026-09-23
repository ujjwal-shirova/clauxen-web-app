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
    `select id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at
     from public.chats
     where user_id = $1 and status != 'deleted'
     order by updated_at desc limit $2`,
    [userId, limit],
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
    [
      id,
      input.userId,
      input.workspaceId ?? null,
      input.title ?? "New chat",
    ],
  );
}

/** Insert with workspace from profiles; retry only an extremely rare id collision. */
export async function createChatFast(input: {
  userId: string;
  title?: string;
  id?: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = input.id ?? generateChatId();
    try {
      return await queryOne<ChatRow>(
        `insert into public.chats (id, user_id, workspace_id, title)
         select
           $1,
           $2,
           (select default_workspace_id from public.profiles where id = $2 limit 1),
           $3
         returning id, user_id, workspace_id, title, status, model_id, starred, created_at, updated_at`,
        [id, input.userId, input.title ?? "New chat"],
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
