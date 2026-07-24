import { query, queryOne } from "@/server/db/pool"; // parameterized SQL — SQL injection safe queries

const MAX_ARTIFACT_LIST_LIMIT = 100;

export async function listArtifacts(
  userId: string,
  limit = MAX_ARTIFACT_LIST_LIMIT,
) {
  const cappedLimit = Math.min(Math.max(1, limit), MAX_ARTIFACT_LIST_LIMIT);
  return query<{
    id: string;
    title: string;
    kind: string;
    status: string;
    created_at: string;
  }>(
    `select id, title, kind, status, created_at
     from public.artifacts
     where user_id = $1 and status = 'active'
     order by created_at desc
     limit $2`,
    [userId, cappedLimit],
  );
}

export async function createArtifact(input: {
  userId: string;
  title: string;
  kind: string;
  chatId?: string | null;
}) {
  return queryOne<{ id: string; title: string; kind: string }>(
    `insert into public.artifacts (user_id, chat_id, title, kind)
     select $1, $2, $3, $4
     where $2::uuid is null
        or exists (
          select 1
          from public.chats
          where id = $2 and user_id = $1 and status != 'deleted'
        )
     returning id, title, kind`,
    [input.userId, input.chatId ?? null, input.title, input.kind],
  );
}
