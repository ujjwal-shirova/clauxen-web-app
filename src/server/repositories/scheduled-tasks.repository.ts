import { query, queryOne } from "@/server/db/pool";
import type { ScheduleFrequency } from "@/server/services/scheduled-tasks-schedule";

export type ScheduledTaskRow = {
  id: string;
  user_id: string;
  name: string;
  requirement: string;
  frequency: ScheduleFrequency;
  time_local: string;
  timezone: string;
  run_date: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  expires_at: string | null;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_chat_id: string | null;
  run_count: number;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ScheduledTaskRunRow = {
  id: string;
  task_id: string;
  user_id: string;
  chat_id: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const TASK_COLUMNS = `
  id, user_id, name, requirement, frequency, time_local, timezone,
  run_date::text, day_of_week, day_of_month, expires_at::text,
  status, next_run_at, last_run_at, last_run_status, last_chat_id,
  run_count, source, metadata, created_at, updated_at
`;

export async function listScheduledTasks(userId: string) {
  return query<ScheduledTaskRow>(
    `select ${TASK_COLUMNS}
     from public.scheduled_tasks
     where user_id = $1 and status <> 'deleted'
     order by
       case when status = 'active' then 0
            when status = 'paused' then 1
            else 2 end,
       coalesce(next_run_at, updated_at) asc`,
    [userId],
  );
}

export async function getScheduledTask(taskId: string, userId: string) {
  return queryOne<ScheduledTaskRow>(
    `select ${TASK_COLUMNS}
     from public.scheduled_tasks
     where id = $1 and user_id = $2 and status <> 'deleted'`,
    [taskId, userId],
  );
}

export async function createScheduledTask(input: {
  userId: string;
  name: string;
  requirement: string;
  frequency: ScheduleFrequency;
  timeLocal: string;
  timezone: string;
  runDate?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  expiresAt?: string | null;
  nextRunAt: string | null;
  source?: "manual" | "chat";
  metadata?: Record<string, unknown>;
}) {
  return queryOne<ScheduledTaskRow>(
    `insert into public.scheduled_tasks (
       user_id, name, requirement, frequency, time_local, timezone,
       run_date, day_of_week, day_of_month, expires_at, next_run_at, source, metadata
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7::date, $8, $9, $10::date, $11::timestamptz, $12, coalesce($13::jsonb, '{}'::jsonb)
     )
     returning ${TASK_COLUMNS}`,
    [
      input.userId,
      input.name,
      input.requirement,
      input.frequency,
      input.timeLocal,
      input.timezone,
      input.runDate ?? null,
      input.dayOfWeek ?? null,
      input.dayOfMonth ?? null,
      input.expiresAt ?? null,
      input.nextRunAt,
      input.source ?? "manual",
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function updateScheduledTask(
  taskId: string,
  userId: string,
  patch: {
    name?: string;
    requirement?: string;
    frequency?: ScheduleFrequency;
    timeLocal?: string;
    timezone?: string;
    runDate?: string | null;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    expiresAt?: string | null;
    nextRunAt?: string | null;
    status?: string;
  },
) {
  return queryOne<ScheduledTaskRow>(
    `update public.scheduled_tasks set
       name = coalesce($3, name),
       requirement = coalesce($4, requirement),
       frequency = coalesce($5, frequency),
       time_local = coalesce($6, time_local),
       timezone = coalesce($7, timezone),
       run_date = case when $8::boolean then $9::date else run_date end,
       day_of_week = case when $10::boolean then $11 else day_of_week end,
       day_of_month = case when $12::boolean then $13 else day_of_month end,
       expires_at = case when $14::boolean then $15::date else expires_at end,
       next_run_at = case when $16::boolean then $17::timestamptz else next_run_at end,
       status = coalesce($18, status),
       updated_at = now()
     where id = $1 and user_id = $2 and status <> 'deleted'
     returning ${TASK_COLUMNS}`,
    [
      taskId,
      userId,
      patch.name ?? null,
      patch.requirement ?? null,
      patch.frequency ?? null,
      patch.timeLocal ?? null,
      patch.timezone ?? null,
      patch.runDate !== undefined,
      patch.runDate ?? null,
      patch.dayOfWeek !== undefined,
      patch.dayOfWeek ?? null,
      patch.dayOfMonth !== undefined,
      patch.dayOfMonth ?? null,
      patch.expiresAt !== undefined,
      patch.expiresAt ?? null,
      patch.nextRunAt !== undefined,
      patch.nextRunAt ?? null,
      patch.status ?? null,
    ],
  );
}

export async function softDeleteScheduledTask(taskId: string, userId: string) {
  return queryOne<{ id: string }>(
    `update public.scheduled_tasks
     set status = 'deleted', next_run_at = null, updated_at = now()
     where id = $1 and user_id = $2 and status <> 'deleted'
     returning id`,
    [taskId, userId],
  );
}

/**
 * Claim up to `limit` due tasks for dispatch (SKIP LOCKED).
 * Moves next_run_at forward 30m as a lease so concurrent cron ticks
 * do not re-claim the same row before execution finishes.
 */
export async function claimDueScheduledTasks(limit = 10) {
  return query<ScheduledTaskRow>(
    `with due as (
       select id
       from public.scheduled_tasks
       where status = 'active'
         and next_run_at is not null
         and next_run_at <= now()
       order by next_run_at asc
       for update skip locked
       limit $1
     )
     update public.scheduled_tasks t
     set
       next_run_at = now() + interval '30 minutes',
       updated_at = now()
     from due
     where t.id = due.id
     returning
       t.id, t.user_id, t.name, t.requirement, t.frequency, t.time_local, t.timezone,
       t.run_date::text, t.day_of_week, t.day_of_month, t.expires_at::text,
       t.status, t.next_run_at, t.last_run_at, t.last_run_status, t.last_chat_id,
       t.run_count, t.source, t.metadata, t.created_at, t.updated_at`,
    [limit],
  );
}

export async function createScheduledTaskRun(input: {
  taskId: string;
  userId: string;
  chatId?: string | null;
}) {
  return queryOne<ScheduledTaskRunRow>(
    `insert into public.scheduled_task_runs (task_id, user_id, chat_id, status)
     values ($1, $2, $3, 'running')
     returning id, task_id, user_id, chat_id, status, started_at, finished_at,
               error_message, summary, metadata, created_at`,
    [input.taskId, input.userId, input.chatId ?? null],
  );
}

export async function finishScheduledTaskRun(input: {
  runId: string;
  status: "success" | "failed" | "skipped";
  chatId?: string | null;
  errorMessage?: string | null;
  summary?: string | null;
}) {
  return queryOne<ScheduledTaskRunRow>(
    `update public.scheduled_task_runs set
       status = $2,
       chat_id = coalesce($3, chat_id),
       error_message = $4,
       summary = $5,
       finished_at = now()
     where id = $1
     returning id, task_id, user_id, chat_id, status, started_at, finished_at,
               error_message, summary, metadata, created_at`,
    [
      input.runId,
      input.status,
      input.chatId ?? null,
      input.errorMessage ?? null,
      input.summary ?? null,
    ],
  );
}

export async function markScheduledTaskAfterRun(input: {
  taskId: string;
  nextRunAt: string | null;
  status: string;
  lastRunStatus: "success" | "failed" | "skipped";
  lastChatId?: string | null;
}) {
  return queryOne<ScheduledTaskRow>(
    `update public.scheduled_tasks set
       last_run_at = now(),
       last_run_status = $2,
       last_chat_id = coalesce($3, last_chat_id),
       run_count = run_count + 1,
       next_run_at = $4::timestamptz,
       status = $5,
       updated_at = now()
     where id = $1
     returning ${TASK_COLUMNS}`,
    [
      input.taskId,
      input.lastRunStatus,
      input.lastChatId ?? null,
      input.nextRunAt,
      input.status,
    ],
  );
}

export async function countActiveScheduledTasks(userId: string) {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count
     from public.scheduled_tasks
     where user_id = $1 and status in ('active', 'paused')`,
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function listRecentRuns(taskId: string, userId: string, limit = 20) {
  return query<ScheduledTaskRunRow>(
    `select id, task_id, user_id, chat_id, status, started_at, finished_at,
            error_message, summary, metadata, created_at
     from public.scheduled_task_runs
     where task_id = $1 and user_id = $2
     order by started_at desc
     limit $3`,
    [taskId, userId, limit],
  );
}
