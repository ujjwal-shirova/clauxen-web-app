-- =============================================================================
-- Migration: supabase_extreme_performance_hardening
-- =============================================================================
--
-- PURPOSE
--   Final Supabase Performance Advisor + Security Advisor remediation pass
--   before wiring the application. Targets low-compute, high-concurrency OLTP:
--   fast RLS evaluation paths, selective partial indexes on hot reads, durable
--   full-text search, role-level statement guardrails, write-friendly storage
--   tuning, and private operational observability.
--
-- PERFORMANCE ADVISOR THEMES ADDRESSED
--   1. Unindexed foreign keys / hot join columns
--      → Partial btree indexes on chats, chat_messages, workspace_members, etc.
--   2. Sequential scans on large append-only tables
--      → BRIN indexes on created_at / usage_date for time-range reporting.
--   3. Missing GIN for text search
--      → STORED tsvector columns + GIN on chat_messages / document_chunks.
--   4. Queue tables scanned by status without selective indexes
--      → Partial indexes on file_processing_jobs, artifact_jobs, webhooks, billing.
--   5. Stale planner statistics on write-heavy tables
--      → Aggressive autovacuum/analyze thresholds + terminal ANALYZE batch.
--   6. Unbounded client queries
--      → Per-role statement_timeout / lock_timeout / idle_in_transaction caps.
--
-- INDEX BUILD STRATEGY (CONCURRENTLY)
--   This migration does NOT use CREATE INDEX CONCURRENTLY. Supabase CLI applies
--   migrations inside a single transaction; PostgreSQL forbids CONCURRENTLY inside
--   a transaction block. All indexes use CREATE INDEX IF NOT EXISTS instead, which
--   is idempotent on re-run and acceptable for one-time deploy windows. For
--   zero-downtime index adds on live multi-GB tables, run equivalent CONCURRENTLY
--   statements manually outside this migration (see Supabase "Index Advisor" docs).
--
-- SCHEMAS TOUCHED
--   extensions  — pg_trgm, pg_prewarm, hypopg, index_advisor (best-effort)
--   private       — operational maintenance + observability (service_role only)
--   public        — product tables, SECURITY DEFINER search helpers
--
-- DOWNSTREAM
--   Follow-on migrations split low-compute maintenance and further advisor cleanup;
--   do not duplicate index drops here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION: Schemas — extensions + private operational namespace
-- -----------------------------------------------------------------------------

create schema if not exists extensions;

create schema if not exists private;

-- private: no client access; service_role runs maintenance and reads reports
revoke all on schema private from public, anon, authenticated;

grant usage on schema private to service_role;

-- -----------------------------------------------------------------------------
-- SECTION: Extensions (best-effort; failures are non-fatal via NOTICE)
-- -----------------------------------------------------------------------------
-- pg_trgm       — fuzzy title/name search GIN indexes (Section: Trigram search)
-- pg_prewarm    — warm hot btree indexes after maintenance (private.prewarm_*)
-- hypopg        — hypothetical index testing (advisor workflows)
-- index_advisor — Supabase index recommendation integration
-- pg_cron       — schedule private.run_clauxen_operational_maintenance (*/30)

do $$
begin
  execute 'create extension if not exists pg_trgm with schema extensions';
exception when others then
  raise notice 'pg_trgm extension was not enabled: %', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists pg_prewarm with schema extensions';
exception when others then
  raise notice 'pg_prewarm extension was not enabled: %', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists hypopg with schema extensions';
exception when others then
  raise notice 'hypopg extension was not enabled: %', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists index_advisor with schema extensions';
exception when others then
  raise notice 'index_advisor extension was not enabled: %', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists pg_cron with schema pg_catalog';
exception when others then
  raise notice 'pg_cron extension was not enabled: %', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- SECTION: Role guardrails — cap runaway PostgREST / client queries
-- -----------------------------------------------------------------------------
-- Advisor: long-running statements hold connections and block autovacuum.
-- JIT is disabled for predictable latency on short OLTP statements.
-- Long generation/research belongs in Edge Functions + job tables, not SQL.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter role anon set statement_timeout = ''8s''';
    execute 'alter role anon set lock_timeout = ''2s''';
    execute 'alter role anon set idle_in_transaction_session_timeout = ''8s''';
    execute 'alter role anon set jit = off';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter role authenticated set statement_timeout = ''20s''';
    execute 'alter role authenticated set lock_timeout = ''3s''';
    execute 'alter role authenticated set idle_in_transaction_session_timeout = ''12s''';
    execute 'alter role authenticated set jit = off';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'alter role service_role set statement_timeout = ''90s''';
    execute 'alter role service_role set lock_timeout = ''5s''';
    execute 'alter role service_role set idle_in_transaction_session_timeout = ''30s''';
    execute 'alter role service_role set jit = off';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- SECTION: Full-text search — chat_messages, document_chunks
-- -----------------------------------------------------------------------------
-- STORED generated tsvector avoids per-query to_tsvector() cost.
-- Replaces legacy content_fts_idx pattern with content_search + GIN.

alter table public.chat_messages
  add column if not exists content_search tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

alter table public.document_chunks
  add column if not exists content_search tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

drop index if exists public.chat_messages_content_fts_idx;

drop index if exists public.document_chunks_content_fts_idx;

create index if not exists chat_messages_content_search_gin_idx
on public.chat_messages using gin (content_search)
where content is not null;

create index if not exists document_chunks_content_search_gin_idx
on public.document_chunks using gin (content_search);

-- -----------------------------------------------------------------------------
-- SECTION: Hot-path indexes — chats, messages, branches, workspace_members
-- -----------------------------------------------------------------------------
-- More selective than broad FK-covering indexes; favor for sidebar/thread reads.
-- Partial predicates match active, non-archived product surfaces.

create index if not exists chats_user_active_updated_idx
on public.chats (user_id, updated_at desc, id)
where status = 'active' and archived_at is null;

create index if not exists chats_workspace_active_updated_idx
on public.chats (workspace_id, updated_at desc, id)
where status = 'active' and archived_at is null;

create index if not exists chat_messages_chat_branch_created_idx
on public.chat_messages (chat_id, branch_id, created_at, id);

create index if not exists chat_messages_active_stream_idx
on public.chat_messages (chat_id, created_at desc, id)
where status in ('queued', 'streaming', 'failed');

create index if not exists chat_branches_chat_created_idx
on public.chat_branches (chat_id, created_at, id);

create index if not exists workspace_members_active_workspace_user_idx
on public.workspace_members (workspace_id, user_id)
where status = 'active';

create index if not exists workspace_members_active_user_workspace_idx
on public.workspace_members (user_id, workspace_id)
where status = 'active';

-- -----------------------------------------------------------------------------
-- SECTION: Hot-path indexes — job queues, webhooks, billing, rate limits
-- -----------------------------------------------------------------------------
-- Worker dequeue: (status, created_at, id) partial scans avoid full table seq scans.
-- Billing: separate partial indexes for open vs fulfilled order lookups.

create index if not exists file_processing_jobs_ready_idx
on public.file_processing_jobs (status, created_at, id)
where status in ('queued', 'running', 'failed');

create index if not exists artifact_jobs_ready_idx
on public.artifact_jobs (status, created_at, id)
where status in ('queued', 'running', 'failed');

create index if not exists gift_delivery_jobs_ready_idx
on public.gift_delivery_jobs (status, created_at, id)
where status in ('queued', 'failed');

create index if not exists webhook_events_unprocessed_idx
on public.webhook_events (status, created_at, id)
where status in ('received', 'failed');

create index if not exists razorpay_webhook_events_status_received_idx
on public.razorpay_webhook_events (status, received_at, id)
where status in ('processed', 'ignored', 'duplicate');

create index if not exists billing_orders_open_user_created_idx
on public.billing_orders (user_id, created_at desc, razorpay_order_id)
where status in ('created', 'attempted', 'failed');

create index if not exists billing_orders_fulfilled_user_created_idx
on public.billing_orders (user_id, created_at desc, razorpay_order_id)
where status = 'fulfilled';

create index if not exists subscriptions_user_active_period_idx
on public.subscriptions (user_id, current_period_end desc, id)
where status in ('trialing', 'active', 'past_due');

create index if not exists gift_codes_purchased_expiry_idx
on public.gift_codes (status, expires_at, id)
where status in ('purchased', 'pending_payment');

create index if not exists rate_limits_identifier_action_window_idx
on public.rate_limits (identifier, action, window_start);

create index if not exists rate_limits_subject_action_window_idx
on public.rate_limits (subject_type, subject_id, action, window_start)
where subject_type is not null and subject_id is not null;

-- -----------------------------------------------------------------------------
-- SECTION: BRIN indexes — append-heavy time-series / audit tables
-- -----------------------------------------------------------------------------
-- Cheap on INSERT; useful for retention sweeps and time-bounded reporting.
-- pages_per_range tuned per table cardinality (64 default, 32 for daily rollups).

create index if not exists chat_messages_created_brin_idx
on public.chat_messages using brin (created_at) with (pages_per_range = 64);

create index if not exists model_usage_events_created_brin_idx
on public.model_usage_events using brin (created_at) with (pages_per_range = 64);

create index if not exists token_transactions_created_brin_idx
on public.token_transactions using brin (created_at) with (pages_per_range = 64);

create index if not exists audit_logs_created_brin_idx
on public.audit_logs using brin (created_at) with (pages_per_range = 64);

create index if not exists webhook_events_created_brin_idx
on public.webhook_events using brin (created_at) with (pages_per_range = 64);

create index if not exists abuse_signals_created_brin_idx
on public.abuse_signals using brin (created_at) with (pages_per_range = 64);

create index if not exists usage_daily_rollups_date_brin_idx
on public.usage_daily_rollups using brin (usage_date) with (pages_per_range = 32);

-- -----------------------------------------------------------------------------
-- SECTION: Trigram (pg_trgm) fuzzy search — chats, artifacts, files, prompts
-- -----------------------------------------------------------------------------
-- Created only when pg_trgm extension succeeded; uses extensions.gin_trgm_ops.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists chats_title_trgm_idx on public.chats using gin (title extensions.gin_trgm_ops) where status = ''active''';
    execute 'create index if not exists artifacts_title_trgm_idx on public.artifacts using gin (title extensions.gin_trgm_ops) where status in (''active'', ''processing'')';
    execute 'create index if not exists user_files_original_name_trgm_idx on public.user_files using gin (original_name extensions.gin_trgm_ops) where status <> ''deleted''';
    execute 'create index if not exists saved_prompts_title_trgm_idx on public.saved_prompts using gin (title extensions.gin_trgm_ops)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- SECTION: Autovacuum / analyze tuning — write-heavy public tables
-- -----------------------------------------------------------------------------
-- Lower scale_factor → more frequent vacuum/analyze on hot paths.
-- fillfactor < 100 leaves HOT-update headroom on frequently updated rows.

alter table public.chat_messages set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500,
  fillfactor = 92
);

alter table public.chat_message_parts set (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.015,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500
);

alter table public.chats set (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.015,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_threshold = 250,
  fillfactor = 90
);

alter table public.model_usage_events set (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.015,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500
);

alter table public.token_transactions set (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.015,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500
);

alter table public.audit_logs set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_threshold = 500
);

alter table public.webhook_events set (
  autovacuum_vacuum_scale_factor = 0.03,
  autovacuum_analyze_scale_factor = 0.015,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_threshold = 250
);

alter table public.rate_limits set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_threshold = 250,
  fillfactor = 85
);

-- -----------------------------------------------------------------------------
-- SECTION: fillfactor only — billing, gifts, jobs, core entity tables
-- -----------------------------------------------------------------------------

alter table public.billing_orders set (fillfactor = 90);

alter table public.billing_payments set (fillfactor = 95);

alter table public.subscriptions set (fillfactor = 90);

alter table public.gift_codes set (fillfactor = 90);

alter table public.research_runs set (fillfactor = 90);

alter table public.file_processing_jobs set (fillfactor = 88);

alter table public.artifact_jobs set (fillfactor = 88);

alter table public.gift_delivery_jobs set (fillfactor = 88);

alter table public.artifacts set (fillfactor = 90);

alter table public.user_files set (fillfactor = 90);

alter table public.user_balances set (fillfactor = 88);

alter table public.user_settings set (fillfactor = 90);

alter table public.profiles set (fillfactor = 90);

alter table public.workspaces set (fillfactor = 90);

-- -----------------------------------------------------------------------------
-- SECTION: SECURITY DEFINER helpers — search, RAG, recent chats
-- -----------------------------------------------------------------------------
-- Executed via service_role from app routes only (see GRANT section below).
-- search_user_messages: GIN-backed FTS over chat_messages.content_search
-- match_document_chunks: pgvector HNSW with iterative_scan for filtered ANN
-- get_recent_chats: index-friendly sidebar listing (chats_user_active_updated_idx)

create or replace function public.search_user_messages(
  p_query text,
  p_limit integer default 20
)
returns table (
  message_id uuid,
  chat_id uuid,
  title text,
  role text,
  content text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  with q as (
    select websearch_to_tsquery('simple', nullif(trim(p_query), '')) as query
  )
  select m.id, m.chat_id, c.title, m.role, m.content, m.created_at
  from q, public.chat_messages m
  join public.chats c on c.id = m.chat_id
  where q.query is not null
    and c.user_id = (select auth.uid())
    and m.content_search @@ q.query
  order by ts_rank_cd(m.content_search, q.query) desc, m.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 10,
  filter jsonb default '{}'::jsonb
)
returns table (
  chunk_id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- pgvector 0.8+ filtered ANN: iterative_scan avoids under-fetch after RLS/metadata filters
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  perform set_config('hnsw.ef_search', '80', true);

  return query
  select
    dc.id as chunk_id,
    dc.source_type,
    dc.source_id,
    dc.content,
    dc.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.document_chunks dc on dc.id = e.chunk_id
  where dc.user_id = (select auth.uid())
    and (filter = '{}'::jsonb or dc.metadata @> filter)
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
end;
$$;

create or replace function public.get_recent_chats(
  p_limit integer default 40,
  p_offset integer default 0
)
returns setof public.chats
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select *
  from public.chats
  where user_id = (select auth.uid())
    and archived_at is null
    and status = 'active'
  order by updated_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- SECTION: private operational functions — prewarm + scheduled maintenance
-- -----------------------------------------------------------------------------

create or replace function private.prewarm_clauxen_hot_indexes()
returns integer
language plpgsql
security definer
set search_path = public, extensions, private, pg_temp
as $$
declare
  v_index_name text;
  v_regclass regclass;
  v_count integer := 0;
  v_indexes text[] := array[
    'public.chats_user_active_updated_idx',
    'public.chat_messages_chat_branch_created_idx',
    'public.chat_message_parts_message_position_idx',
    'public.workspace_members_active_user_workspace_idx',
    'public.workspace_members_active_workspace_user_idx',
    'public.subscriptions_user_active_period_idx',
    'public.billing_orders_open_user_created_idx',
    'public.file_processing_jobs_ready_idx',
    'public.artifact_jobs_ready_idx'
  ];
begin
  if not exists (select 1 from pg_extension where extname = 'pg_prewarm') then
    return 0;
  end if;

  foreach v_index_name in array v_indexes loop
    v_regclass := to_regclass(v_index_name);
    if v_regclass is not null then
      begin
        execute format('select extensions.pg_prewarm(%L::regclass)', v_index_name);
        v_count := v_count + 1;
      exception when others then
        null;
      end;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function private.run_clauxen_operational_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, private, pg_temp
as $$
declare
  v_prewarmed integer := 0;
begin
  delete from public.rate_limits
  where updated_at < now() - interval '2 days';

  perform public.expire_old_gift_codes();
  perform public.rollup_model_usage(now() - interval '3 days', now());
  v_prewarmed := private.prewarm_clauxen_hot_indexes();

  analyze public.chats;
  analyze public.chat_messages;
  analyze public.chat_message_parts;
  analyze public.model_usage_events;
  analyze public.token_transactions;
  analyze public.billing_orders;
  analyze public.subscriptions;
  analyze public.file_processing_jobs;
  analyze public.artifact_jobs;
  analyze public.gift_delivery_jobs;
  analyze public.rate_limits;

  return jsonb_build_object(
    'status', 'ok',
    'prewarmed_indexes', v_prewarmed,
    'ran_at', now()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- SECTION: private observability views — slow queries + table bloat health
-- -----------------------------------------------------------------------------
-- Requires pg_stat_statements in extensions schema (Supabase default).

create or replace view private.slow_query_report as
select
  calls,
  round(mean_exec_time::numeric, 3) as mean_exec_ms,
  round(max_exec_time::numeric, 3) as max_exec_ms,
  round(total_exec_time::numeric, 3) as total_exec_ms,
  rows,
  left(regexp_replace(query, '\s+', ' ', 'g'), 500) as query_sample
from extensions.pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by total_exec_time desc
limit 100;

create or replace view private.table_health_report as
select
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  round((n_dead_tup::numeric / greatest(n_live_tup + n_dead_tup, 1)) * 100, 2) as dead_tuple_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by n_dead_tup desc, n_live_tup desc;

-- -----------------------------------------------------------------------------
-- SECTION: Privileges — service_role only for DEFINER functions + maintenance
-- -----------------------------------------------------------------------------

revoke all on function public.search_user_messages(text, integer) from public, anon, authenticated;

revoke all on function public.match_document_chunks(extensions.vector, integer, jsonb) from public, anon, authenticated;

revoke all on function public.get_recent_chats(integer, integer) from public, anon, authenticated;

grant execute on function public.search_user_messages(text, integer) to service_role;

grant execute on function public.match_document_chunks(extensions.vector, integer, jsonb) to service_role;

grant execute on function public.get_recent_chats(integer, integer) to service_role;

revoke all on function private.prewarm_clauxen_hot_indexes() from public, anon, authenticated;

revoke all on function private.run_clauxen_operational_maintenance() from public, anon, authenticated;

grant execute on function private.prewarm_clauxen_hot_indexes() to service_role;

grant execute on function private.run_clauxen_operational_maintenance() to service_role;

-- -----------------------------------------------------------------------------
-- SECTION: pg_cron — operational maintenance every 30 minutes
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('clauxen_operational_maintenance');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'clauxen_operational_maintenance',
      '*/30 * * * *',
      'select private.run_clauxen_operational_maintenance();'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- SECTION: Post-migration ANALYZE — refresh planner stats for new indexes
-- -----------------------------------------------------------------------------
-- Complements autovacuum tuning above; run once at deploy, then via cron job.

analyze public.chats;

analyze public.chat_messages;

analyze public.chat_message_parts;

analyze public.document_chunks;

analyze public.embeddings;

analyze public.model_usage_events;

analyze public.token_transactions;

analyze public.billing_orders;

analyze public.billing_payments;

analyze public.subscriptions;

analyze public.gift_codes;

analyze public.file_processing_jobs;

analyze public.artifact_jobs;

analyze public.gift_delivery_jobs;

analyze public.rate_limits;
