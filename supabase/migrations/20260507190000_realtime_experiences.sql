-- =============================================================================
-- Migration: 20260507190000_realtime_experiences
-- Purpose: Register app tables with supabase_realtime and set REPLICA IDENTITY
--          FULL so Postgres logical replication emits complete row images for
--          UPDATE/DELETE fan-out to browser clients.
-- Prerequisites:
--   - supabase_realtime publication exists (Supabase default).
--   - Listed tables already created in prior platform migrations.
-- Apply-time behavior:
--   - Idempotent DO block adds each table to supabase_realtime (ignores dupes).
--   - Sets replica identity full on chat, billing, research, and storage tables.
-- Security / RLS:
--   - Does not change RLS or grants. Realtime still respects RLS on the
--     subscribing role; clients only receive events for rows they can SELECT.
-- Rollback guidance:
--   - ALTER PUBLICATION supabase_realtime DROP TABLE for each table added.
--   - ALTER TABLE ... REPLICA IDENTITY DEFAULT (may break UPDATE payloads).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Publication membership: supabase_realtime
-- Swallows duplicate_object / undefined_object so re-runs are safe.
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_tables text[] := array[
    'chat_branch_states',
    'research_runs',
    'research_sources',
    'user_objects',
    'user_files',
    'gift_codes',
    'gift_redemptions',
    'subscriptions',
    'subscription_activation_events',
    'billing_orders',
    'billing_payments',
    'user_balances',
    'token_transactions'
  ];
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

-- -----------------------------------------------------------------------------
-- Replica identity: FULL row images for logical replication
-- Required for Supabase Realtime to deliver old+new column values on UPDATE.
-- -----------------------------------------------------------------------------
alter table if exists public.chats replica identity full;

alter table if exists public.chat_messages replica identity full;

alter table if exists public.chat_branch_states replica identity full;

alter table if exists public.artifacts replica identity full;

alter table if exists public.file_processing_jobs replica identity full;

alter table if exists public.research_runs replica identity full;

alter table if exists public.user_objects replica identity full;

alter table if exists public.user_files replica identity full;

alter table if exists public.gift_codes replica identity full;

alter table if exists public.gift_redemptions replica identity full;

alter table if exists public.subscriptions replica identity full;

alter table if exists public.subscription_activation_events replica identity full;

alter table if exists public.billing_orders replica identity full;

alter table if exists public.billing_payments replica identity full;

alter table if exists public.user_balances replica identity full;
