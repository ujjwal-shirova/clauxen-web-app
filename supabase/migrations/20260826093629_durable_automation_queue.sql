-- Durable automation dispatch: Supabase is the source of truth, Cloudflare
-- Queues provides at-least-once delivery, and Vercel executes one run/request.

alter table public.scheduled_tasks
  add column if not exists notification_mode text not null default 'email_app',
  add column if not exists model_mode text not null default 'fast',
  add column if not exists connector_ids text[] not null default '{}'::text[],
  add column if not exists skill_ids text[] not null default '{}'::text[],
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists lease_until timestamptz,
  add column if not exists lease_run_id uuid;

alter table public.scheduled_tasks
  drop constraint if exists scheduled_tasks_notification_mode_check,
  add constraint scheduled_tasks_notification_mode_check
    check (notification_mode in ('email_app', 'email_only', 'app_only', 'off')),
  drop constraint if exists scheduled_tasks_model_mode_check,
  add constraint scheduled_tasks_model_mode_check
    check (model_mode in ('fast', 'thinking')),
  drop constraint if exists scheduled_tasks_attachment_refs_array_check,
  add constraint scheduled_tasks_attachment_refs_array_check
    check (jsonb_typeof(attachment_refs) = 'array');

alter table public.scheduled_task_runs
  drop constraint if exists scheduled_task_runs_status_check;

alter table public.scheduled_task_runs
  add column if not exists scheduled_for timestamptz,
  add column if not exists execution_key text,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add constraint scheduled_task_runs_status_check
    check (status in ('queued', 'running', 'success', 'failed', 'skipped')),
  add constraint scheduled_task_runs_attempt_count_check
    check (attempt_count >= 0);

-- Existing rows predate durable dispatch. Their IDs make safe stable keys.
update public.scheduled_task_runs
set scheduled_for = coalesce(scheduled_for, started_at),
    execution_key = coalesce(execution_key, 'legacy:' || id::text)
where scheduled_for is null or execution_key is null;

alter table public.scheduled_task_runs
  alter column scheduled_for set not null,
  alter column execution_key set not null;

create unique index if not exists scheduled_task_runs_execution_key_idx
  on public.scheduled_task_runs (execution_key);

create index if not exists scheduled_task_runs_claim_idx
  on public.scheduled_task_runs (status, lease_expires_at, queued_at)
  where status in ('queued', 'running');

create index if not exists scheduled_tasks_lease_idx
  on public.scheduled_tasks (lease_until)
  where lease_until is not null;

alter table public.scheduled_tasks
  drop constraint if exists scheduled_tasks_lease_run_id_fkey,
  add constraint scheduled_tasks_lease_run_id_fkey
    foreign key (lease_run_id) references public.scheduled_task_runs(id)
    on delete set null;

create table if not exists public.automation_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.scheduled_tasks(id) on delete cascade,
  run_id uuid not null references public.scheduled_task_runs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  status text not null check (status in ('success', 'failed', 'skipped')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id)
);

create index if not exists automation_notifications_user_created_idx
  on public.automation_notifications (user_id, created_at desc);

alter table public.automation_notifications enable row level security;

drop policy if exists automation_notifications_own_select on public.automation_notifications;
create policy automation_notifications_own_select
  on public.automation_notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists automation_notifications_own_update on public.automation_notifications;
create policy automation_notifications_own_update
  on public.automation_notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on public.automation_notifications to authenticated;

comment on column public.scheduled_task_runs.execution_key is
  'Stable task+scheduled-time key used to make at-least-once queue delivery idempotent.';
comment on column public.scheduled_tasks.lease_run_id is
  'Run currently owned by the dispatcher. Cleared only by that run on terminal completion.';
