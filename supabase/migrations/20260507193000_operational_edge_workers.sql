-- =============================================================================
-- Migration: 20260507193000_operational_edge_workers
-- Purpose: Add edge-worker operational tables (gift delivery, usage rollups,
--          artifact jobs, abuse signals), owner-read RLS, SECURITY DEFINER RPCs,
--          and Realtime publication membership.
-- Prerequisites:
--   - public.set_updated_at() trigger function.
--   - public.gift_codes, workspaces, artifacts, model_usage_events, embeddings.
-- Apply-time behavior:
--   - Creates four tables with CHECK constraints and updated_at triggers.
--   - Adds queue/status indexes and embeddings chunk uniqueness.
--   - RLS: authenticated SELECT own rows only (no client writes).
--   - queue_gift_delivery / rollup_model_usage: SECURITY DEFINER, service_role.
--   - Registers tables on supabase_realtime with REPLICA IDENTITY FULL.
-- Security / RLS:
--   - Client roles cannot INSERT/UPDATE worker tables; workers use service_role.
--   - SECURITY DEFINER RPCs use fixed search_path; granted only to service_role.
-- Rollback guidance:
--   - DROP TABLE for each created table CASCADE.
--   - DROP FUNCTION queue_gift_delivery, rollup_model_usage.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Table: gift_delivery_jobs
-- One row per gift; edge worker sends email/link delivery.
-- -----------------------------------------------------------------------------
create table if not exists public.gift_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gift_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_method text not null check (delivery_method in ('email', 'link')),
  recipient_email text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  provider text,
  provider_message_id text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gift_id)
);

create trigger gift_delivery_jobs_set_updated_at
before update on public.gift_delivery_jobs
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Table: usage_daily_rollups
-- Aggregated model_usage_events per user/workspace/day/provider/model.
-- -----------------------------------------------------------------------------
create table if not exists public.usage_daily_rollups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  usage_date date not null,
  provider text,
  model_id text,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_minor bigint not null default 0,
  generation_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id, usage_date, provider, model_id)
);

create trigger usage_daily_rollups_set_updated_at
before update on public.usage_daily_rollups
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Table: artifact_jobs
-- Async build/export/snapshot/repair work for artifacts.
-- -----------------------------------------------------------------------------
create table if not exists public.artifact_jobs (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references public.artifacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  job_type text not null check (job_type in ('build', 'export', 'snapshot', 'repair')),
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  attempts integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger artifact_jobs_set_updated_at
before update on public.artifact_jobs
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Table: abuse_signals
-- Edge-captured abuse/fraud signals (severity 1-5).
-- -----------------------------------------------------------------------------
create table if not exists public.abuse_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  signal_type text not null,
  severity integer not null default 1 check (severity between 1 and 5),
  source text not null default 'edge',
  fingerprint text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes: worker queues and abuse lookups
-- -----------------------------------------------------------------------------
create index if not exists gift_delivery_jobs_status_idx on public.gift_delivery_jobs (status, created_at);

create index if not exists usage_daily_rollups_user_date_idx on public.usage_daily_rollups (user_id, usage_date desc);

create index if not exists artifact_jobs_status_idx on public.artifact_jobs (status, created_at);

create index if not exists abuse_signals_user_created_idx on public.abuse_signals (user_id, created_at desc);

create index if not exists abuse_signals_fingerprint_created_idx on public.abuse_signals (fingerprint, created_at desc);

-- Enforce one embedding row per chunk (dedupe ingestion).
create unique index if not exists embeddings_chunk_unique_idx on public.embeddings (chunk_id);

-- -----------------------------------------------------------------------------
-- Row level security: owner read-only for authenticated clients
-- -----------------------------------------------------------------------------
alter table public.gift_delivery_jobs enable row level security;

alter table public.usage_daily_rollups enable row level security;

alter table public.artifact_jobs enable row level security;

alter table public.abuse_signals enable row level security;

drop policy if exists "gift_delivery_jobs_owner_read" on public.gift_delivery_jobs;

create policy "gift_delivery_jobs_owner_read" on public.gift_delivery_jobs
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "usage_daily_rollups_owner_read" on public.usage_daily_rollups;

create policy "usage_daily_rollups_owner_read" on public.usage_daily_rollups
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "artifact_jobs_owner_read" on public.artifact_jobs;

create policy "artifact_jobs_owner_read" on public.artifact_jobs
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "abuse_signals_owner_read" on public.abuse_signals;

create policy "abuse_signals_owner_read" on public.abuse_signals
for select to authenticated
using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RPC: queue_gift_delivery
-- SECURITY DEFINER: locks gift row, enqueues delivery job (idempotent per gift).
-- -----------------------------------------------------------------------------
create or replace function public.queue_gift_delivery(p_gift_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gift_codes;
  v_job_id uuid;
begin
  select * into v_gift
  from public.gift_codes
  where id = p_gift_id
  for update;

  if not found then
    raise exception 'Gift not found';
  end if;

  if v_gift.status <> 'purchased' then
    raise exception 'Gift is not ready for delivery';
  end if;

  insert into public.gift_delivery_jobs (
    gift_id, user_id, delivery_method, recipient_email, metadata
  )
  values (
    v_gift.id,
    v_gift.purchaser_user_id,
    v_gift.delivery_method,
    v_gift.recipient_email,
    jsonb_build_object('recipientName', v_gift.recipient_name, 'planName', v_gift.plan_name)
  )
  on conflict (gift_id) do update set
    status = case when public.gift_delivery_jobs.status = 'failed' then 'queued' else public.gift_delivery_jobs.status end,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: rollup_model_usage
-- SECURITY DEFINER: aggregates model_usage_events into usage_daily_rollups.
-- -----------------------------------------------------------------------------
create or replace function public.rollup_model_usage(p_from timestamptz default now() - interval '2 days', p_to timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.usage_daily_rollups (
    user_id, workspace_id, usage_date, provider, model_id,
    input_tokens, output_tokens, total_tokens, generation_count
  )
  select
    user_id,
    workspace_id,
    date_trunc('day', created_at)::date,
    provider,
    model_id,
    sum(input_tokens)::bigint,
    sum(output_tokens)::bigint,
    sum(input_tokens + output_tokens)::bigint,
    count(*)::integer
  from public.model_usage_events
  where created_at >= p_from and created_at < p_to
  group by user_id, workspace_id, date_trunc('day', created_at)::date, provider, model_id
  on conflict (user_id, workspace_id, usage_date, provider, model_id)
  do update set
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    total_tokens = excluded.total_tokens,
    generation_count = excluded.generation_count,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: publication + replica identity
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_tables text[] := array['gift_delivery_jobs', 'usage_daily_rollups', 'artifact_jobs', 'abuse_signals'];
begin
  foreach v_table in array v_tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

alter table if exists public.gift_delivery_jobs replica identity full;

alter table if exists public.usage_daily_rollups replica identity full;

alter table if exists public.artifact_jobs replica identity full;

alter table if exists public.abuse_signals replica identity full;

-- -----------------------------------------------------------------------------
-- Grants: worker RPCs callable only by service_role
-- -----------------------------------------------------------------------------
grant execute on function public.queue_gift_delivery(uuid) to service_role;

grant execute on function public.rollup_model_usage(timestamptz, timestamptz) to service_role;
