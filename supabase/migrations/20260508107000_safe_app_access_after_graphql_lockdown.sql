-- =============================================================================
-- Migration: 20260508107000_safe_app_access_after_graphql_lockdown
-- Purpose: Restore minimal app-safe access after 20260508105000 lockdown:
--   - Drop pg_graphql from production until an explicit surface is designed.
--   - Keep anon off raw public tables.
--   - Grant authenticated SELECT only on RLS-protected Realtime tables.
--   - Re-enable RLS, publication membership, and REPLICA IDENTITY FULL.
-- Prerequisites:
--   - 20260508105000_security_advisor_graphql_lockdown.sql applied.
--   - RLS owner/member policies exist on listed tables from platform migrations.
-- Apply-time behavior:
--   - DROP EXTENSION pg_graphql; drop graphql/graphql_public schemas if present.
--   - REVOKE SELECT from public/anon; GRANT schema usage to authenticated.
--   - GRANT SELECT on enumerated tables to authenticated.
--   - Loop: ENABLE RLS, add to supabase_realtime, REPLICA IDENTITY FULL.
-- Security / RLS:
--   - Table grants allow PostgREST/Realtime connection; RLS enforces row access.
--   - anon has no table SELECT; writes remain service_role / RPC paths.
-- Rollback guidance:
--   - REVOKE authenticated SELECT; re-apply lockdown migration pattern if needed.
-- =============================================================================

drop extension if exists pg_graphql cascade;

-- -----------------------------------------------------------------------------
-- Remove graphql schemas if remnants exist
-- -----------------------------------------------------------------------------
do $$
declare
  v_schema text;
begin
  foreach v_schema in array array['graphql_public', 'graphql'] loop
    if exists (select 1 from pg_namespace where nspname = v_schema) then
      begin
        execute format('revoke usage on schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke usage on schema %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('drop schema if exists %I cascade', v_schema);
      exception when others then
        raise notice 'Could not drop schema %: %', v_schema, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Narrow grants: authenticated Realtime tables only
-- -----------------------------------------------------------------------------
revoke select on all tables in schema public from public, anon;

revoke usage on schema public from anon;

grant usage on schema public to authenticated;

grant select on table
  public.chats,
  public.chat_messages,
  public.chat_branch_states,
  public.artifacts,
  public.file_processing_jobs,
  public.user_files,
  public.research_runs,
  public.subscriptions,
  public.subscription_activation_events,
  public.billing_orders,
  public.billing_payments,
  public.user_balances,
  public.gift_codes,
  public.gift_redemptions,
  public.token_transactions,
  public.user_objects
to authenticated;

-- -----------------------------------------------------------------------------
-- Ensure RLS + Realtime publication + full replica identity per app table
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_tables text[] := array[
    'chats',
    'chat_messages',
    'chat_branch_states',
    'artifacts',
    'file_processing_jobs',
    'user_files',
    'research_runs',
    'subscriptions',
    'subscription_activation_events',
    'billing_orders',
    'billing_payments',
    'user_balances',
    'gift_codes',
    'gift_redemptions',
    'token_transactions',
    'user_objects'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    begin
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
    execute format('alter table public.%I replica identity full', v_table);
  end loop;
end $$;
