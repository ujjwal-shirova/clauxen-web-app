-- =============================================================================
-- Migration: 20260508103000_extension_schema_corrections
-- Purpose: Install schema-sensitive extensions (pg_net, pgmq) in required
--          locations, revoke API-role access to extension internals, provision
--          Clauxen job queues, and expose private.enqueue_clauxen_job to
--          service_role only.
-- Prerequisites:
--   - private schema exists.
--   - Supabase may pre-create net schema when pg_net is partially installed.
-- Apply-time behavior:
--   - Best-effort CREATE EXTENSION pg_net / pgmq with NOTICE on failure.
--   - Revoke public/anon/authenticated on net and pgmq; grant service_role.
--   - Creates named pgmq queues for billing, chat, artifacts, etc.
--   - SECURITY DEFINER enqueue wrapper validates queue allowlist.
-- Security / RLS:
--   - Extension schemas are not client-accessible; workers use service_role.
--   - enqueue_clauxen_job rejects unknown queue names before pgmq.send.
-- Rollback guidance:
--   - DROP FUNCTION private.enqueue_clauxen_job; DROP EXTENSION pgmq/pg_net if safe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pg_net: install in default net schema when absent
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      drop schema if exists net;
    exception when dependent_objects_still_exist then
      raise notice 'net schema is not empty; pg_net install will be attempted without dropping it';
    end;

    begin
      create extension pg_net;
    exception when others then
      raise notice 'pg_net could not be enabled: %', sqlerrm;
    end;
  end if;
end $$;

create schema if not exists pgmq;

-- -----------------------------------------------------------------------------
-- pgmq: dedicated schema for queue tables
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgmq') then
    begin
      create extension pgmq with schema pgmq;
    exception when others then
      raise notice 'pgmq could not be enabled: %', sqlerrm;
    end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Lock down net / pgmq: service_role only
-- -----------------------------------------------------------------------------
do $$
declare
  v_schema text;
begin
  foreach v_schema in array array['net', 'pgmq'] loop
    if exists (select 1 from pg_namespace where nspname = v_schema) then
      begin
        execute format('revoke all on schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke schema privileges on %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant usage on schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant schema usage on %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('revoke all on all tables in schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke table privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('revoke all on all routines in schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke routine privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant all on all tables in schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant table privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant execute on all routines in schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant routine privileges in %: %', v_schema, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Provision Clauxen pgmq queues (idempotent)
-- -----------------------------------------------------------------------------
do $$
declare
  v_queue text;
begin
  if exists (select 1 from pg_extension where extname = 'pgmq') then
    foreach v_queue in array array[
      'clauxen_billing',
      'clauxen_chat',
      'clauxen_artifacts',
      'clauxen_embeddings',
      'clauxen_research',
      'clauxen_notifications',
      'clauxen_webhooks',
      'clauxen_exports',
      'clauxen_oauth'
    ] loop
      begin
        perform pgmq.create(v_queue);
      exception
        when duplicate_table then null;
        when unique_violation then null;
        when others then
          raise notice 'Queue % could not be created: %', v_queue, sqlerrm;
      end;
    end loop;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- RPC: private.enqueue_clauxen_job
-- SECURITY DEFINER: allowlisted queue names only; optional delay seconds.
-- -----------------------------------------------------------------------------
create or replace function private.enqueue_clauxen_job(
  p_queue_name text,
  p_payload jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, private, pg_temp
as $$
declare
  v_msg_id bigint;
begin
  if p_queue_name not in (
    'clauxen_billing',
    'clauxen_chat',
    'clauxen_artifacts',
    'clauxen_embeddings',
    'clauxen_research',
    'clauxen_notifications',
    'clauxen_webhooks',
    'clauxen_exports',
    'clauxen_oauth'
  ) then
    raise exception 'Queue is not allowed';
  end if;

  select pgmq.send(p_queue_name, p_payload, greatest(p_delay_seconds, 0))
  into v_msg_id;

  return v_msg_id;
end;
$$;

revoke all on function private.enqueue_clauxen_job(text, jsonb, integer) from public, anon, authenticated;

grant execute on function private.enqueue_clauxen_job(text, jsonb, integer) to service_role;
