-- =============================================================================
-- Migration: 20260508110000_dashboard_visibility_without_client_surface
-- Purpose: Restore Supabase Studio / PostgREST schema visibility after lockdown
--          without reopening broad client table access:
--   - Revoke inherited broad grants from anon/authenticated.
--   - Re-grant authenticated SELECT only on validated Realtime tables.
--   - Grant dashboard_user full editor access; supabase_read_only_user read-only.
--   - Reconfigure authenticator role pgrst.* settings and NOTIFY reload.
-- Prerequisites:
--   - 20260508107000_safe_app_access_after_graphql_lockdown.sql applied.
--   - authenticator role exists (Supabase PostgREST).
-- Apply-time behavior:
--   - REVOKE ALL on public tables/sequences from anon, authenticated.
--   - ALTER DEFAULT PRIVILEGES to withhold future grants from API roles.
--   - GRANT USAGE on public to anon, authenticated, service_role.
--   - GRANT SELECT on enumerated tables to authenticated only.
--   - Conditional grants to dashboard_user / supabase_read_only_user.
--   - ALTER ROLE authenticator SET pgrst.db_schemas / db_extra_search_path.
--   - NOTIFY pgrst reload config and schema.
-- Security / RLS:
--   - anon retains schema USAGE but no table privileges (no direct reads).
--   - authenticated SELECT is grant-level; RLS still filters rows.
-- Rollback guidance:
--   - Revert authenticator settings; REVOKE dashboard grants if over-exposed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Remove broad client grants inherited from original schema bootstrap
-- -----------------------------------------------------------------------------
revoke all privileges on all tables in schema public from anon, authenticated;

revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges in schema public
  revoke all privileges on sequences from anon, authenticated;

-- Schema resolution for PostgREST/realtime; table access remains grant-controlled.
grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Authenticated: SELECT only on RLS-protected Realtime/browser tables
-- -----------------------------------------------------------------------------
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
-- Supabase Studio / internal roles (not public API roles)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'dashboard_user') then
    execute 'grant usage on schema public to dashboard_user';
    execute 'grant all privileges on all tables in schema public to dashboard_user';
    execute 'grant all privileges on all sequences in schema public to dashboard_user';
    execute 'grant execute on all functions in schema public to dashboard_user';
    execute 'alter default privileges in schema public grant all privileges on tables to dashboard_user';
    execute 'alter default privileges in schema public grant all privileges on sequences to dashboard_user';
    execute 'alter default privileges in schema public grant execute on functions to dashboard_user';
  end if;

  if exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    execute 'grant usage on schema public to supabase_read_only_user';
    execute 'grant select on all tables in schema public to supabase_read_only_user';
    execute 'grant usage, select on all sequences in schema public to supabase_read_only_user';
    execute 'grant execute on all functions in schema public to supabase_read_only_user';
    execute 'alter default privileges in schema public grant select on tables to supabase_read_only_user';
    execute 'alter default privileges in schema public grant usage, select on sequences to supabase_read_only_user';
    execute 'alter default privileges in schema public grant execute on functions to supabase_read_only_user';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- PostgREST authenticator: expose public in API schema cache
-- Table grants above determine what anon/authenticated clients can touch.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_schemas = ''public,graphql_public''';
    execute 'alter role authenticator set pgrst.db_extra_search_path = ''public,extensions''';
  end if;
end $$;

notify pgrst, 'reload config';

notify pgrst, 'reload schema';
