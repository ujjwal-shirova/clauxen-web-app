-- Durable chat generations: time-sliced background tasks that survive Vercel's
-- 300s function cap and browser disconnects.
--
-- A chat turn runs as a JOB made of chained SLICES. Each slice runs in one
-- Vercel invocation (soft budget ~240s), checkpoints its full agent state to
-- this table, then either completes the turn or chains the next slice via the
-- internal /continue endpoint. Total turn duration is unbounded: slices chain
-- until the model finishes, however many rounds that takes.
--
-- Status lifecycle:
--   queued -> running -> continuing -> running -> ... -> complete|failed|cancelled
--   running -> paused_for_user (ask_user_input; user's answer starts a new job)
--   running|continuing (heartbeat stale) -> reclaimed by the watchdog
--
-- Postgres is the durable source of truth. Cloudflare's Durable Object keeps
-- the live trace for fast UI reads; the watchdog + archive paths only consult
-- this table for recovery decisions.

create table if not exists public.chat_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Durable turn rows. Null until the first slice inserts them.
  assistant_message_id uuid references public.chat_messages(id) on delete set null,
  user_message_id uuid references public.chat_messages(id) on delete set null,
  status text not null default 'queued'
    check (status in (
      'queued', 'running', 'continuing',
      'paused_for_user', 'complete', 'failed', 'cancelled'
    )),
  -- How many slices have run (slice 0 = the live user-facing slice).
  slice_index integer not null default 0,
  -- Crash-retry counter for the current slice. A slice that dies without a
  -- checkpoint is retried from the last checkpoint, not from scratch.
  attempt integer not null default 0,
  -- Worker identity holding this job (vercel isolate id + timestamp).
  locked_by text,
  locked_at timestamptz,
  -- Fresh while a slice is alive. Stale heartbeat = dead slice = watchdog
  -- reclaims the job and chains a replacement slice.
  heartbeat_at timestamptz not null default now(),
  -- Full turn input so any slice can resume without the original request:
  -- { messages, turn, vision, chatModel, homerReasoningEffort,
  --   extendedThinking, clientTimezone, userCountryCode, generateChatTitle,
  --   requestId, turnStartedAtMs, systemPromptAppend? }
  input jsonb not null default '{}'::jsonb,
  -- Full agent checkpoint (round boundary): { version, step, conversation,
  -- narrationCounter, answer, thinking, thinkingAccumulatedMs, segments,
  -- tools, modelTurns, generatedTitle, turnStartedAtMs, ... }. Written after
  -- every completed tool round and on every slice yield.
  checkpoint jsonb not null default '{}'::jsonb,
  -- Terminal summary: { status, answerChars, toolCount, sliceCount,
  -- completedAtMs, error? }.
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One live job per chat. A follow-up send while a job is live gets 409 and
-- its message is queued, exactly like the previous DO-lease behaviour.
create unique index if not exists chat_generation_jobs_one_active_per_chat
  on public.chat_generation_jobs (chat_id)
  where status in ('queued', 'running', 'continuing');

-- Watchdog scan: live jobs ordered by stalest heartbeat first.
create index if not exists chat_generation_jobs_watchdog_idx
  on public.chat_generation_jobs (heartbeat_at asc)
  where status in ('queued', 'running', 'continuing');

create index if not exists chat_generation_jobs_chat_created_idx
  on public.chat_generation_jobs (chat_id, created_at desc);

create index if not exists chat_generation_jobs_user_created_idx
  on public.chat_generation_jobs (user_id, created_at desc);

-- Service-role only. Browser clients never read this table directly; they use
-- /live (Cloudflare trace) and /generate/status (derived activity flag).
alter table public.chat_generation_jobs enable row level security;
revoke all on table public.chat_generation_jobs from public;
revoke all on table public.chat_generation_jobs from anon;
revoke all on table public.chat_generation_jobs from authenticated;
grant all on table public.chat_generation_jobs to service_role;

-- Atomically claim a job for a slice. Only one claimant wins; everyone else
-- gets NULL (no wait). Callable states:
--   queued       -> always claimable (fresh job)
--   continuing   -> claimable (chained slice; heartbeat may still look fresh
--                   because the previous slice just yielded)
--   running      -> claimable only when the heartbeat is stale (dead slice)
-- Terminal states are never claimable.
create or replace function public.claim_chat_generation_job(
  p_job_id uuid,
  p_worker text,
  p_running_stale_after interval default interval '90 seconds'
)
returns public.chat_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.chat_generation_jobs;
begin
  select *
  into v_job
  from public.chat_generation_jobs
  where id = p_job_id
  for update skip locked;

  if not found then
    return null;
  end if;

  if v_job.status = 'queued' then
    -- fall through to claim
    null;
  elsif v_job.status = 'continuing' then
    -- fall through to claim
    null;
  elsif v_job.status = 'running'
    and v_job.heartbeat_at < now() - p_running_stale_after then
    -- Dead slice: retry from the last checkpoint.
    null;
  else
    return null;
  end if;

  update public.chat_generation_jobs
  set status = 'running',
      locked_by = p_worker,
      locked_at = now(),
      heartbeat_at = now(),
      attempt = case
        when v_job.status = 'running' then v_job.attempt + 1
        else 0
      end,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_chat_generation_job(uuid, text, interval) from public;
revoke execute on function public.claim_chat_generation_job(uuid, text, interval) from anon;
revoke execute on function public.claim_chat_generation_job(uuid, text, interval) from authenticated;
grant execute on function public.claim_chat_generation_job(uuid, text, interval) to service_role;

-- Watchdog helper: oldest live jobs whose heartbeat expired (or queued jobs
-- that never got claimed), excluding jobs already locked by a live worker.
create or replace function public.list_stalled_chat_generation_jobs(
  p_running_stale_after interval default interval '90 seconds',
  p_limit integer default 10
)
returns setof public.chat_generation_jobs
language sql
security definer
set search_path = public
as $$
  select *
  from public.chat_generation_jobs
  where (
    status = 'running' and heartbeat_at < now() - p_running_stale_after
  ) or (
    status = 'continuing' and heartbeat_at < now() - interval '60 seconds'
  ) or (
    status = 'queued' and created_at < now() - interval '60 seconds'
  )
  order by heartbeat_at asc
  limit greatest(1, least(p_limit, 25));
$$;

revoke all on function public.list_stalled_chat_generation_jobs(interval, integer) from public;
revoke execute on function public.list_stalled_chat_generation_jobs(interval, integer) from anon;
revoke execute on function public.list_stalled_chat_generation_jobs(interval, integer) from authenticated;
grant execute on function public.list_stalled_chat_generation_jobs(interval, integer) to service_role;

comment on table public.chat_generation_jobs is
  'Durable chat-turn jobs: chained time slices with Postgres checkpoints so turns longer than the serverless cap still finish.';
