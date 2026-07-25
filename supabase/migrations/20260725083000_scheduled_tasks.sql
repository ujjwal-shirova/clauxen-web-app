-- Scheduled Tasks (automations): user-owned cron-like prompts that run into new chats.

create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  requirement text not null check (char_length(requirement) between 1 and 8000),
  frequency text not null
    check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  -- Local wall-clock time "HH:MM" in the task timezone (24h).
  time_local text not null
    check (time_local ~ '^\d{2}:\d{2}$'),
  timezone text not null default 'UTC',
  -- once: run_date; weekly: 0=Sun..6=Sat; monthly: 1..31
  run_date date,
  day_of_week smallint check (day_of_week is null or day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 31),
  expires_at date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'failed', 'deleted')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_run_status text
    check (last_run_status is null or last_run_status in ('success', 'failed', 'skipped')),
  last_chat_id text references public.chats(id) on delete set null,
  run_count integer not null default 0 check (run_count >= 0),
  source text not null default 'manual'
    check (source in ('manual', 'chat')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_tasks_once_needs_date check (
    frequency <> 'once' or run_date is not null
  ),
  constraint scheduled_tasks_weekly_needs_dow check (
    frequency <> 'weekly' or day_of_week is not null
  ),
  constraint scheduled_tasks_monthly_needs_dom check (
    frequency <> 'monthly' or day_of_month is not null
  )
);

create index if not exists scheduled_tasks_user_status_idx
  on public.scheduled_tasks (user_id, status, updated_at desc);

create index if not exists scheduled_tasks_due_idx
  on public.scheduled_tasks (next_run_at asc)
  where status = 'active' and next_run_at is not null;

comment on table public.scheduled_tasks is
  'User scheduled automations — run requirement prompts into new chats on a cadence.';

create table if not exists public.scheduled_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.scheduled_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id text references public.chats(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_task_runs_task_started_idx
  on public.scheduled_task_runs (task_id, started_at desc);

create index if not exists scheduled_task_runs_user_started_idx
  on public.scheduled_task_runs (user_id, started_at desc);

comment on table public.scheduled_task_runs is
  'Execution history for scheduled_tasks — one row per attempted run.';

alter table public.scheduled_tasks enable row level security;
alter table public.scheduled_task_runs enable row level security;

drop policy if exists scheduled_tasks_own on public.scheduled_tasks;
create policy scheduled_tasks_own
  on public.scheduled_tasks
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists scheduled_task_runs_own on public.scheduled_task_runs;
create policy scheduled_task_runs_own
  on public.scheduled_task_runs
  for select
  to authenticated
  using (user_id = auth.uid());

-- Touch updated_at on mutation.
create or replace function public.touch_scheduled_tasks_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists scheduled_tasks_touch_updated_at on public.scheduled_tasks;
create trigger scheduled_tasks_touch_updated_at
  before update on public.scheduled_tasks
  for each row
  execute function public.touch_scheduled_tasks_updated_at();

grant select, insert, update, delete on public.scheduled_tasks to authenticated;
grant select on public.scheduled_task_runs to authenticated;
