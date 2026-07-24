import { query, queryOne } from "@/server/db/pool";

export type ResearchRunRow = {
  id: string; // primary key UUID
  user_id: string;
  provider: string; // external provider name (e.g. 'parallel')
  provider_run_id: string;
  objective: string;
  processor: string; // processor tier (base, pro, etc.)
  status: string; // queued | running | completed | failed — state machine
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function listResearchRuns(userId: string, limit = 50) {
  return query<ResearchRunRow>(
    `select id, user_id, provider, provider_run_id, objective, processor, status,
            result, error, created_at, updated_at
     from public.research_runs
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
}

export async function getResearchRun(runId: string, userId: string) {
  return queryOne<ResearchRunRow>(
    `select id, user_id, provider, provider_run_id, objective, processor, status,
            result, error, created_at, updated_at
     from public.research_runs
     where id = $1 and user_id = $2`,
    [runId, userId],
  );
}

export async function createResearchRun(input: {
  userId: string;
  objective: string;
  providerRunId: string;
  processor?: string;
  chatId?: string | null;
}) {
  return queryOne<ResearchRunRow>(
    `insert into public.research_runs (
       user_id, provider, provider_run_id, objective, processor, status, chat_id
     ) values ($1, 'parallel', $2, $3, $4, 'queued', $5)
     returning id, user_id, provider, provider_run_id, objective, processor, status,
               result, error, created_at, updated_at`,
    [
      input.userId, // $1 — run owner
      input.providerRunId, // $2 — external provider run id
      input.objective, // $3 — research goal text
      input.processor ?? "base",
      input.chatId ?? null, // $5 — optional linked chat — null = standalone research
    ],
  );
}
