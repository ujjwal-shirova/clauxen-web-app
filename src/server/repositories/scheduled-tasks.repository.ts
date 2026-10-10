import { query, queryOne, withTransaction } from "@/server/db/pool";
import { AppError } from "@/server/db/errors";
import {
  computeNextRunAt,
  type ScheduleFrequency,
} from "@/server/services/scheduled-tasks-schedule";

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
  skill_ids: string[];
  attachment_refs: Array<Record<string, unknown>>;
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
  run_count, source, metadata, notification_mode, model_mode,
  skill_ids, attachment_refs, lease_until, lease_run_id,
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
  skillIds?: string[];
  attachmentRefs?: Array<Record<string, unknown>>;
}) {
  return withTransaction(async (client) => {
    await client.query(
      "select id from public.profiles where id=$1 for update",
      [input.userId],
    );
    const active = await client.query<{ count: string }>(
      "select count(*)::text as count from public.scheduled_tasks where user_id=$1 and status in ('active','paused')",
      [input.userId],
    );
    if (Number(active.rows[0]?.count) >= 15)
      throw new AppError(
        "You can have at most 15 active scheduled tasks.",
        400,
      );
    const result = await client.query<ScheduledTaskRow>(
      `insert into public.scheduled_tasks (
       user_id, name, requirement, frequency, time_local, timezone,
       run_date, day_of_week, day_of_month, expires_at, next_run_at, source, metadata,
       notification_mode, model_mode, skill_ids, attachment_refs
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7::date, $8, $9, $10::date, $11::timestamptz, $12, coalesce($13::jsonb, '{}'::jsonb),
       $14, $15, $16::text[], $17::jsonb
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
        input.skillIds ?? [],
        JSON.stringify(input.attachmentRefs ?? []),
      ],
    );
    return result.rows[0] ?? null;
  });
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
    skillIds?: string[];
    attachmentRefs?: Array<Record<string, unknown>>;
  },
) {
  return withTransaction(async (client) => {
    if (patch.status === "active" || patch.status === "paused") {
      await client.query(
        "select id from public.profiles where id=$1 for update",
        [userId],
      );
      const existing = await client.query<{ status: string }>(
        "select status from public.scheduled_tasks where id=$1 and user_id=$2 for update",
        [taskId, userId],
      );
      if (
        existing.rows[0] &&
        !["active", "paused"].includes(existing.rows[0].status)
      ) {
        const active = await client.query<{ count: string }>(
          "select count(*)::text as count from public.scheduled_tasks where user_id=$1 and status in ('active','paused')",
          [userId],
        );
        if (Number(active.rows[0]?.count) >= 15)
          throw new AppError(
            "You can have at most 15 active scheduled tasks.",
            400,
          );
      }
    }
    const result = await client.query<ScheduledTaskRow>(
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
       skill_ids = coalesce($21::text[], skill_ids),
       attachment_refs = coalesce($22::jsonb, attachment_refs),
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
        patch.skillIds ?? null,
        patch.attachmentRefs === undefined
          ? null
          : JSON.stringify(patch.attachmentRefs),
      ],
    );
    return result.rows[0] ?? null;
  });
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

export async function requeueScheduledTaskRun(
  runId: string,
  errorMessage: string,
  attempt: number,
) {
  return queryOne<ScheduledTaskRunRow>(
    `update public.scheduled_task_runs set
       status = 'queued', queued_at = now(), lease_expires_at = null,
       error_message = left($2, 2000)
     where id = $1 and status = 'running' and attempt_count=$3
     returning ${RUN_COLUMNS}`,
    [runId, errorMessage, attempt],
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

/** Queue a manual run under a task lock so repeated clicks cannot overlap. */
export async function queueManualScheduledRun(taskId: string, userId: string) {
  return withTransaction(async (client) => {
    const task = await client.query<{ id: string; lease_until: string | null }>(
      `select id, lease_until from public.scheduled_tasks
       where id = $1 and user_id = $2 and status = 'active'
       for update`,
      [taskId, userId],
    );
    if (!task.rows[0]) return null;
    const pending = await client.query<{ id: string }>(
      `select id from public.scheduled_task_runs where task_id = $1
       and status in ('queued','running') limit 1`,
      [taskId],
    );
    if (pending.rows[0]) return { id: pending.rows[0].id };
    if (
      task.rows[0].lease_until &&
      new Date(task.rows[0].lease_until).getTime() > Date.now()
    )
      return null;
    const result = await client.query<{ id: string }>(
      `insert into public.scheduled_task_runs
       (task_id,user_id,status,scheduled_for,execution_key,queued_at,metadata)
       values ($1,$2,'queued',now(),'manual:' || gen_random_uuid()::text,now(),'{"manual":true}'::jsonb)
       returning id`,
      [taskId, userId],
    );
    return result.rows[0];
  });
}

export async function claimQueuedScheduledRuns(limit: number) {
  return query<QueuedScheduledRun>(
    `with pending as (
       select t.id as task_id, r.id, r.execution_key, r.scheduled_for
       from public.scheduled_tasks t join public.scheduled_task_runs r on r.task_id=t.id
       where (r.status='queued' or (r.status='running' and r.lease_expires_at <= now()))
         and (t.lease_until is null or t.lease_until <= now())
       order by r.queued_at for update of t skip locked limit $1
     ), reset_runs as (
       update public.scheduled_task_runs r set status='queued',queued_at=now(),lease_expires_at=null
       from pending p where r.id=p.id returning r.id
     ), leased as (
       update public.scheduled_tasks t set lease_until=now()+interval '15 minutes',lease_run_id=p.id
       from pending p join reset_runs r on r.id=p.id where t.id=p.task_id
       returning p.id,p.task_id,p.execution_key,p.scheduled_for
     ) select id as "runId",task_id as "taskId",execution_key as "executionKey",scheduled_for as "scheduledFor" from leased`,
    [limit],
  );
}

/** Create and attach the result chat in one transaction before admission. */
export async function ensureScheduledRunChat(
  run: ScheduledTaskRunRow,
  task: ScheduledTaskRow,
) {
  return withTransaction(async (client) => {
    await client.query(
      "select id from public.scheduled_tasks where id=$1 for update",
      [task.id],
    );
    const locked = await client.query<ScheduledTaskRunRow>(
      `select ${RUN_COLUMNS} from public.scheduled_task_runs where id=$1 for update`,
      [run.id],
    );
    const current = locked.rows[0];
    if (
      !current ||
      current.status !== "running" ||
      current.attempt_count !== run.attempt_count
    )
      throw new AppError("Scheduled run ownership changed.", 409);
    if (current.chat_id) return current.chat_id;
    // Run UUID is a stable, valid chat ID even if admission is retried.
    await client.query(
      `insert into public.chats(id,user_id,workspace_id,title)
      select $1,$2,default_workspace_id,$3 from public.profiles where id=$2`,
      [run.id, task.user_id, task.name],
    );
    await client.query(
      "update public.scheduled_task_runs set chat_id=$1 where id=$1",
      [run.id],
    );
    return run.id;
  });
}

/** Refresh active durable-job leases and return terminal runs for reconciliation. */
export async function listScheduledRunCompletions(limit: number) {
  return query<{
    run: ScheduledTaskRunRow;
    job_status: string;
    job_error: string | null;
    answer: string | null;
  }>(
    `
    with active as (
      update public.scheduled_task_runs r set lease_expires_at=now()+interval '10 minutes'
      from public.chat_generation_jobs j where r.status='running' and r.chat_id=j.chat_id
        and j.input->'turn'->>'assistantClientId'='sched-a-'||r.id::text
        and j.status in ('queued','running','continuing') returning r.id,r.task_id
    ), renewed as (
      update public.scheduled_tasks t set lease_until=now()+interval '15 minutes'
      from active a where t.id=a.task_id and t.lease_run_id=a.id returning t.id
    )
    select row_to_json(r)::jsonb as run,j.status as job_status,j.error as job_error,m.content as answer
    from public.scheduled_task_runs r join public.chat_generation_jobs j on j.chat_id=r.chat_id
      and j.input->'turn'->>'assistantClientId'='sched-a-'||r.id::text
    left join public.chat_messages m on m.id=j.assistant_message_id
    where r.status='running' and j.status in ('complete','failed','cancelled','paused_for_user')
    order by r.started_at limit $1`,
    [limit],
  );
}

/** Run completion and next schedule commit together; a repeated call is a no-op. */
export async function completeScheduledRun(input: {
  runId: string;
  status: "success" | "failed" | "skipped";
  summary: string;
  errorMessage?: string | null;
  attempt?: number;
}) {
  return withTransaction(async (client) => {
    const selected = await client.query<ScheduledTaskRow>(
      `select ${TASK_COLUMNS}
      from public.scheduled_tasks where id=(select task_id from public.scheduled_task_runs where id=$1) for update`,
      [input.runId],
    );
    const task = selected.rows[0];
    if (!task) return null;
    const updated = await client.query<ScheduledTaskRunRow>(
      `update public.scheduled_task_runs set
      status=$2,summary=left($3,500),error_message=$4,finished_at=now(),lease_expires_at=null,
      metadata=metadata||'{"notification_pending":true}'::jsonb
      where id=$1 and status='running' and ($5::integer is null or attempt_count=$5)
      returning ${RUN_COLUMNS}`,
      [
        input.runId,
        input.status,
        input.summary,
        input.errorMessage ?? null,
        input.attempt ?? null,
      ],
    );
    const run = updated.rows[0];
    if (!run) return null;
    const manual = run.metadata?.manual === true;
    const next =
      task.status === "active"
        ? computeNextRunAt(
            {
              frequency: task.frequency,
              timeLocal: task.time_local,
              timezone: task.timezone,
              runDate: task.run_date,
              dayOfWeek: task.day_of_week,
              dayOfMonth: task.day_of_month,
              expiresAt: task.expires_at,
            },
            new Date(),
          )
        : null;
    await client.query(
      `update public.scheduled_tasks set last_run_at=now(),last_run_status=$3,
      last_chat_id=coalesce($4,last_chat_id),run_count=run_count+1,updated_at=now(),
      next_run_at=case when $5 then next_run_at when status='active' then $6::timestamptz else null end,
      status=case when $5 or status<>'active' then status when $6::timestamptz is null then 'completed' else 'active' end,
      lease_until=null,lease_run_id=null where id=$1 and lease_run_id=$2`,
      [
        task.id,
        run.id,
        input.status,
        run.chat_id,
        manual,
        next?.toISOString() ?? null,
      ],
    );
    return { task, run };
  });
}

export async function claimScheduledNotifications(limit: number) {
  return query<{ task: ScheduledTaskRow; run: ScheduledTaskRunRow }>(
    `
    with pending as (
      select id from public.scheduled_task_runs where status in ('success','failed','skipped')
        and metadata->>'notification_pending'='true'
        and coalesce((metadata->>'notification_lease_until')::timestamptz,'epoch'::timestamptz)<now()
      order by finished_at limit $1 for update skip locked
    ), claimed as (
      update public.scheduled_task_runs r set metadata=metadata||jsonb_build_object('notification_lease_until',now()+interval '5 minutes')
      from pending p where r.id=p.id returning r.*
    ) select row_to_json(t)::jsonb as task,row_to_json(r)::jsonb as run
      from claimed r join public.scheduled_tasks t on t.id=r.task_id`,
    [limit],
  );
}

export async function markScheduledNotificationDelivered(runId: string) {
  await query(
    `update public.scheduled_task_runs set metadata=metadata||'{"notification_pending":false}'::jsonb where id=$1`,
    [runId],
  );
}
