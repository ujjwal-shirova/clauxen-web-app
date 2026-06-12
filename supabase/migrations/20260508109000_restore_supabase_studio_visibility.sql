-- =============================================================================
-- Migration: 20260508109000_restore_supabase_studio_visibility
-- Purpose: Restore Supabase Studio table editor visibility after GraphQL/API
--          lockdown revoked broad grants from the public pseudo-role.
-- Prerequisites:
--   - 20260508105000_security_advisor_graphql_lockdown.sql applied.
--   - dashboard_user and/or supabase_read_only_user roles exist (Supabase host).
-- Apply-time behavior:
--   - Conditionally GRANT USAGE/SELECT on public schema objects to internal
--     dashboard roles; sets default privileges for future objects.
-- Security / RLS:
--   - Does not grant anon/authenticated additional access.
--   - Internal roles bypass client RLS expectations via platform configuration.
-- Rollback guidance:
--   - REVOKE grants from dashboard_user / supabase_read_only_user if needed.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'dashboard_user') then
    execute 'grant usage on schema public to dashboard_user';
    execute 'grant select on all tables in schema public to dashboard_user';
    execute 'grant usage, select on all sequences in schema public to dashboard_user';
    execute 'alter default privileges in schema public grant select on tables to dashboard_user';
    execute 'alter default privileges in schema public grant usage, select on sequences to dashboard_user';
  end if;

  if exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    execute 'grant usage on schema public to supabase_read_only_user';
    execute 'grant select on all tables in schema public to supabase_read_only_user';
    execute 'grant usage, select on all sequences in schema public to supabase_read_only_user';
    execute 'alter default privileges in schema public grant select on tables to supabase_read_only_user';
    execute 'alter default privileges in schema public grant usage, select on sequences to supabase_read_only_user';
  end if;
end $$;
