-- Connector cost and scale guardrails.
-- Queue deliveries are at-least-once, so audit events carry an idempotency key.
alter table public.connector_audit_events
  add column if not exists event_id uuid not null default gen_random_uuid();

create unique index if not exists connector_audit_events_event_id_uidx
  on public.connector_audit_events (event_id);

-- Small BRIN indexes keep time-based retention cheap as append-only event
-- tables grow, without the write amplification of wide B-tree indexes.
create index if not exists connector_audit_events_created_brin_idx
  on public.connector_audit_events using brin (created_at)
  with (pages_per_range = 32);

create index if not exists connector_health_checks_checked_brin_idx
  on public.connector_health_checks using brin (checked_at)
  with (pages_per_range = 32);

create index if not exists connector_oauth_transactions_created_brin_idx
  on private.connector_oauth_transactions using brin (created_at)
  with (pages_per_range = 32);

create index if not exists connector_action_approvals_terminal_created_idx
  on public.connector_action_approvals (created_at)
  where status in ('denied', 'expired', 'consumed');

alter table public.connector_audit_events set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 100
);

alter table public.connector_health_checks set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 100
);

-- Every deletion is bounded to avoid long transactions, large WAL spikes, and
-- lock pressure on small Supabase compute. Repeated daily runs drain backlogs.
create or replace function private.run_connector_cost_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_oauth integer := 0;
  v_approvals integer := 0;
  v_audit integer := 0;
  v_health integer := 0;
  v_cron_logs integer := 0;
begin
  update private.connector_oauth_transactions
  set status = 'expired'
  where status = 'pending' and expires_at <= now();

  update public.connector_action_approvals
  set status = 'expired'
  where status in ('pending', 'approved') and expires_at <= now();

  with expired as (
    select ctid
    from private.connector_oauth_transactions
    where created_at < now() - interval '24 hours'
    order by created_at
    limit 5000
  )
  delete from private.connector_oauth_transactions target
  using expired
  where target.ctid = expired.ctid;
  get diagnostics v_oauth = row_count;

  with expired as (
    select ctid
    from public.connector_action_approvals
    where status in ('denied', 'expired', 'consumed')
      and created_at < now() - interval '7 days'
    order by created_at
    limit 5000
  )
  delete from public.connector_action_approvals target
  using expired
  where target.ctid = expired.ctid;
  get diagnostics v_approvals = row_count;

  with expired as (
    select ctid
    from public.connector_audit_events
    where created_at < now() - interval '90 days'
    order by created_at
    limit 5000
  )
  delete from public.connector_audit_events target
  using expired
  where target.ctid = expired.ctid;
  get diagnostics v_audit = row_count;

  with expired as (
    select ctid
    from public.connector_health_checks
    where checked_at < now() - interval '14 days'
    order by checked_at
    limit 5000
  )
  delete from public.connector_health_checks target
  using expired
  where target.ctid = expired.ctid;
  get diagnostics v_health = row_count;

  if to_regclass('cron.job_run_details') is not null then
    execute $cleanup$
      with expired as (
        select ctid
        from cron.job_run_details
        where end_time < now() - interval '14 days'
        order by end_time
        limit 10000
      )
      delete from cron.job_run_details target
      using expired
      where target.ctid = expired.ctid
    $cleanup$;
    get diagnostics v_cron_logs = row_count;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'oauth_transactions_deleted', v_oauth,
    'approvals_deleted', v_approvals,
    'audit_events_deleted', v_audit,
    'health_checks_deleted', v_health,
    'cron_logs_deleted', v_cron_logs,
    'ran_at', now()
  );
end;
$$;

revoke all on function private.run_connector_cost_maintenance()
  from public, anon, authenticated;
grant execute on function private.run_connector_cost_maintenance()
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('clauxen_connector_cost_maintenance');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'clauxen_connector_cost_maintenance',
      '43 4 * * *',
      'select private.run_connector_cost_maintenance();'
    );
  end if;
end $$;

analyze public.connector_audit_events;
analyze public.connector_health_checks;
analyze public.connector_action_approvals;
