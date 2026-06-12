-- =============================================================================
-- Migration: 20260508105000_security_advisor_graphql_lockdown
-- Purpose: Close pg_graphql schema discovery paths by revoking broad SELECT on
--          public tables and locking down extension schemas; drop pg_net until
--          database webhooks are required (cannot relocate net schema on Supabase).
-- Prerequisites:
--   - Prior platform migrations created public tables and extensions.
-- Apply-time behavior:
--   - DROP EXTENSION pg_net CASCADE.
--   - REVOKE SELECT on all public tables/sequences from public, anon, authenticated.
--   - ALTER DEFAULT PRIVILEGES to withhold future table SELECT from API roles.
--   - Revoke SELECT on pgtap helper views if present.
--   - Revoke USAGE on pgtap, graphql, graphql_public, pgmq, pgsodium, partman.
-- Security / RLS:
--   - RLS alone is insufficient if roles retain table-level SELECT grants that
--     pg_graphql can enumerate. This migration removes that grant surface.
--   - Application access restored in 20260508107000_safe_app_access_*.
-- Rollback guidance:
--   - Re-grant SELECT on required tables to authenticated (see follow-up migration).
--   - CREATE EXTENSION pg_net when webhooks are needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pg_net removal
-- Extension owns net schema; cannot move off public on hosted Supabase today.
-- -----------------------------------------------------------------------------
drop extension if exists pg_net cascade;

-- -----------------------------------------------------------------------------
-- Revoke broad table/sequence SELECT from API roles
-- -----------------------------------------------------------------------------
revoke select on all tables in schema public from public, anon, authenticated;

revoke select on all sequences in schema public from public, anon, authenticated;

alter default privileges in schema public
  revoke select on tables from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- pgtap views: revoke if extension left helper views exposed
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.views
    where table_schema = 'pgtap'
      and table_name = 'pg_all_foreign_keys'
  ) then
    begin
      revoke select on pgtap.pg_all_foreign_keys from public, anon, authenticated;
    exception when others then
      raise notice 'Could not revoke SELECT on pgtap.pg_all_foreign_keys: %', sqlerrm;
    end;
  end if;

  if exists (
    select 1
    from information_schema.views
    where table_schema = 'pgtap'
      and table_name = 'tap_funky'
  ) then
    begin
      revoke select on pgtap.tap_funky from public, anon, authenticated;
    exception when others then
      raise notice 'Could not revoke SELECT on pgtap.tap_funky: %', sqlerrm;
    end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Extension schemas: deny USAGE to API roles
-- -----------------------------------------------------------------------------
do $$
declare
  v_schema text;
begin
  foreach v_schema in array array['pgtap', 'graphql', 'graphql_public', 'pgmq', 'pgsodium', 'partman'] loop
    if exists (select 1 from pg_namespace where nspname = v_schema) then
      begin
        execute format('revoke usage on schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke schema usage on %: %', v_schema, sqlerrm;
      end;
    end if;
  end loop;
end $$;
