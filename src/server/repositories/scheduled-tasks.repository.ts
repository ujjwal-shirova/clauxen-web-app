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
  notification_mode: "email_app" | "email_only" | "app_only" | "off";
  model_mode: "fast" | "thinking";
  connector_ids: string[];
  skill_ids: string[];
  attachment_refs: Array<Record<string, unknown>>;
  project_id: string | null;
  lease_until: string | null;
  lease_run_id: string | null;
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
  scheduled_for: string;
  execution_key: string;
  queued_at: string;
  lease_expires_at: string | null;
  attempt_count: number;
};

export type QueuedScheduledRun = {
  runId: string;
  taskId: string;
  executionKey: string;
  scheduledFor: string;
};

const TASK_COLUMNS = `
  id, user_id, name, requirement, frequency, time_local, timezone,
  run_date::text, day_of_week, day_of_month, expires_at::text,
  status, next_run_at, last_run_at, last_run_status, last_chat_id,
  run_count, source, metadata, notification_mode, model_mode, connector_ids,
  skill_ids, attachment_refs, project_id, lease_until, lease_run_id,
  created_at, updated_at
`;

const RUN_COLUMNS = `
  id, task_id, user_id, chat_id, status, started_at, finished_at,
  error_message, summary, metadata, created_at, scheduled_for, execution_key,
  queued_at, lease_expires_at, attempt_count
`;

const RUN_COLUMNS_ALIASED = `
  r.id, r.task_id, r.user_id, r.chat_id, r.status, r.started_at, r.finished_at,
  r.error_message, r.summary, r.metadata, r.created_at, r.scheduled_for,
  r.execution_key, r.queued_at, r.lease_expires_at, r.attempt_count
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
  notificationMode?: ScheduledTaskRow["notification_mode"];
  modelMode?: ScheduledTaskRow["model_mode"];
  connectorIds?: string[];
  skillIds?: string[];
  attachmentRefs?: Array<Record<string, unknown>>;
  projectId?: string | null;
}) {
  return queryOne<ScheduledTaskRow>(
    `insert into public.scheduled_tasks (
       user_id, name, requirement, frequency, time_local, timezone,
       run_date, day_of_week, day_of_month, expires_at, next_run_at, source, metadata,
       notification_mode, model_mode, connector_ids, skill_ids, attachment_refs, project_id
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7::date, $8, $9, $10::date, $11::timestamptz, $12, coalesce($13::jsonb, '{}'::jsonb),
       $14, $15, $16::text[], $17::text[], $18::jsonb, $19::uuid
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
      input.notificationMode ?? "email_app",
      input.modelMode ?? "fast",
      input.connectorIds ?? [],
      input.skillIds ?? [],
      JSON.stringify(input.attachmentRefs ?? []),
      input.projectId ?? null,
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
    notificationMode?: ScheduledTaskRow["notification_mode"];
    modelMode?: ScheduledTaskRow["model_mode"];
    connectorIds?: string[];
    skillIds?: string[];
    attachmentRefs?: Array<Record<string, unknown>>;
    projectId?: string | null;
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
       notification_mode = coalesce($19, notification_mode),
       model_mode = coalesce($20, model_mode),
       connector_ids = coalesce($21::text[], connector_ids),
       skill_ids = coalesce($22::text[], skill_ids),
       attachment_refs = coalesce($23::jsonb, attachment_refs),
       project_id = case when $24::boolean then $25::uuid else project_id end,
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
      patch.notificationMode ?? null,
      patch.modelMode ?? null,
      patch.connectorIds ?? null,
      patch.skillIds ?? null,
      patch.attachmentRefs === undefined
        ? null
        : JSON.stringify(patch.attachmentRefs),
      patch.projectId !== undefined,
      patch.projectId ?? null,
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

/** Atomically creates/reclaims idempotent queue jobs for due schedules. */
export async function claimDueScheduledTasks(limit = 10) {
  return query<QueuedScheduledRun>(
    `with due as (
       select id, user_id, next_run_at as scheduled_for
       from public.scheduled_tasks
       where status = 'active'
         and next_run_at is not null
         and next_run_at <= now()
         and (lease_until is null or lease_until <= now())
       order by next_run_at asc
       for update skip locked
       limit $1
     ), claimed as (
       insert into public.scheduled_task_runs (
         task_id, user_id, status, scheduled_for, execution_key, queued_at
       )
       select d.id, d.user_id, 'queued', d.scheduled_for,
              d.id::text || ':' || floor(extract(epoch from d.scheduled_for))::bigint::text,
              now()
       from due d
       on conflict (execution_key) do update set
         status = 'queued', queued_at = now(), lease_expires_at = null,
         error_message = null, finished_at = null
       where scheduled_task_runs.status = 'queued'
          or (scheduled_task_runs.status = 'running'
              and scheduled_task_runs.lease_expires_at <= now())
       returning id, task_id, execution_key, scheduled_for
     ), leased as (
       update public.scheduled_tasks t
       set lease_until = now() + interval '15 minutes',
           lease_run_id = c.id,
           updated_at = now()
       from claimed c
       where t.id = c.task_id
       returning c.id, c.task_id, c.execution_key, c.scheduled_for
     )
     select id as "runId", task_id as "taskId", execution_key as "executionKey",
            scheduled_for as "scheduledFor"
     from leased`,
    [limit],
  );
}

export async function acquireScheduledTaskRun(runId: string) {
  return queryOne<{ task: ScheduledTaskRow; run: ScheduledTaskRunRow }>(
    `with acquired as (
       update public.scheduled_task_runs r set
         status = 'running', started_at = now(), finished_at = null,
         lease_expires_at = now() + interval '10 minutes',
         attempt_count = attempt_count + 1
       where r.id = $1
         and (r.status = 'queued'
           or (r.status = 'running' and r.lease_expires_at <= now()))
       returning r.*
     )
     select row_to_json(t)::jsonb as task, row_to_json(a)::jsonb as run
     from acquired a
     join public.scheduled_tasks t on t.id = a.task_id`,
    [runId],
  );
}

export async function getScheduledTaskRun(runId: string) {
  return queryOne<ScheduledTaskRunRow>(
    `select ${RUN_COLUMNS} from public.scheduled_task_runs where id = $1`,
    [runId],
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
       finished_at = now(),
       lease_expires_at = null
     where id = $1
     returning ${RUN_COLUMNS}`,
    [
      input.runId,
      input.status,
      input.chatId ?? null,
      input.errorMessage ?? null,
      input.summary ?? null,
    ],
  );
}

export async function requeueScheduledTaskRun(
  runId: string,
  errorMessage: string,
) {
  return queryOne<ScheduledTaskRunRow>(
    `update public.scheduled_task_runs set
       status = 'queued', queued_at = now(), lease_expires_at = null,
       error_message = left($2, 2000)
     where id = $1 and status = 'running'
     returning ${RUN_COLUMNS}`,
    [runId, errorMessage],
  );
}

export async function markScheduledTaskAfterRun(input: {
  taskId: string;
  nextRunAt: string | null;
  status: string;
  lastRunStatus: "success" | "failed" | "skipped";
  lastChatId?: string | null;
  runId: string;
}) {
  return queryOne<ScheduledTaskRow>(
    `update public.scheduled_tasks set
       last_run_at = now(),
       last_run_status = $2,
       last_chat_id = coalesce($3, last_chat_id),
       run_count = run_count + 1,
       next_run_at = $4::timestamptz,
       status = $5,
       lease_until = null,
       lease_run_id = null,
       updated_at = now()
     where id = $1 and lease_run_id = $6
     returning ${TASK_COLUMNS}`,
    [
      input.taskId,
      input.lastRunStatus,
      input.lastChatId ?? null,
      input.nextRunAt,
      input.status,
      input.runId,
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

export async function listRecentRuns(
  taskId: string,
  userId: string,
  limit = 20,
) {
  return query<ScheduledTaskRunRow>(
    `select ${RUN_COLUMNS}
     from public.scheduled_task_runs
     where task_id = $1 and user_id = $2
     order by started_at desc
     limit $3`,
    [taskId, userId, limit],
  );
}

export async function listRecentRunsForUser(userId: string, limit = 50) {
  return query<ScheduledTaskRunRow & { task_name: string }>(
    `select ${RUN_COLUMNS_ALIASED},
            t.name as task_name
     from public.scheduled_task_runs r
     join public.scheduled_tasks t on t.id = r.task_id
     where r.user_id = $1
     order by r.queued_at desc
     limit $2`,
    [userId, limit],
  );
}

export async function createAutomationNotification(input: {
  task: ScheduledTaskRow;
  run: ScheduledTaskRunRow;
  body: string;
}) {
  return queryOne<{ id: string }>(
    `insert into public.automation_notifications
       (user_id, task_id, run_id, title, body, status)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (run_id) do nothing
     returning id`,
    [
      input.task.user_id,
      input.task.id,
      input.run.id,
      `${input.task.name} ${input.run.status === "success" ? "completed" : "failed"}`,
      input.body,
      input.run.status,
    ],
  );
}

export async function getAutomationUserEmail(userId: string) {
  return queryOne<{ email: string }>(
    `select email from auth.users where id = $1 and email is not null`,
    [userId],
  );
}
