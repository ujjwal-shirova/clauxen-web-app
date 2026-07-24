import { query, queryOne } from "@/server/db/pool";

/** Project-scoped chats (maps legacy "conversations" to public.chats). */
export type ProjectChatRow = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectMessageRow = {
  id: string;
  chat_id: string;
  role: string;
  content: string | null;
  created_at: string;
};

export async function listProjectChats(projectId: string, userId: string) {
  return query<ProjectChatRow>(
    `select id, project_id, user_id, title, starred, created_at, updated_at
     from public.chats
     where project_id = $1 and user_id = $2 and status != 'deleted'
     order by updated_at desc`,
    [projectId, userId],
  );
}

export async function getProjectChat(
  chatId: string,
  projectId: string,
  userId: string,
) {
  return queryOne<ProjectChatRow>(
    `select id, project_id, user_id, title, starred, created_at, updated_at
     from public.chats
     where id = $1 and project_id = $2 and user_id = $3 and status != 'deleted'`,
    [chatId, projectId, userId],
  );
}

export async function createProjectChat(input: {
  projectId: string;
  userId: string;
  title?: string;
}) {
  return queryOne<ProjectChatRow>(
    `insert into public.chats (user_id, project_id, title)
     values ($1, $2, $3)
     returning id, project_id, user_id, title, starred, created_at, updated_at`,
    [input.userId, input.projectId, input.title ?? "New conversation"],
  );
}

export async function updateProjectChat(
  chatId: string,
  projectId: string,
  userId: string,
  patch: { title?: string; starred?: boolean },
) {
  return queryOne<ProjectChatRow>(
    `update public.chats set
       title = coalesce($4, title),
       starred = coalesce($5, starred),
       updated_at = now()
     where id = $1 and project_id = $2 and user_id = $3 and status != 'deleted'
     returning id, project_id, user_id, title, starred, created_at, updated_at`,
    [chatId, projectId, userId, patch.title ?? null, patch.starred ?? null],
  );
}

export async function deleteProjectChat(
  chatId: string,
  projectId: string,
  userId: string,
) {
  return queryOne<{ id: string }>(
    `update public.chats set status = 'deleted', updated_at = now()
     where id = $1 and project_id = $2 and user_id = $3 and status != 'deleted'
     returning id`,
    [chatId, projectId, userId],
  );
}

export async function listProjectMessages(chatId: string) {
  return query<ProjectMessageRow>(
    `select id, chat_id, role, content, created_at
     from public.chat_messages
     where chat_id = $1 and status != 'cancelled'
     order by created_at asc`,
    [chatId],
  );
}

export async function createProjectMessage(input: {
  chatId: string;
  userId?: string | null;
  role: string;
  content: string;
}) {
  return queryOne<ProjectMessageRow>(
    `insert into public.chat_messages (chat_id, user_id, role, content, status)
     values ($1, $2, $3, $4, 'complete')
     returning id, chat_id, role, content, created_at`,
    [input.chatId, input.userId ?? null, input.role, input.content],
  );
}

export async function touchProjectChat(chatId: string) {
  await queryOne(
    `update public.chats set updated_at = now() where id = $1 returning id`,
    [chatId],
  );
}

export async function touchProject(projectId: string) {
  await queryOne(
    `update public.projects set updated_at = now() where id = $1 returning id`,
    [projectId],
  );
}
