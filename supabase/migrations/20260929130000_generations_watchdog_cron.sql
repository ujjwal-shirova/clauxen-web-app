-- Per-minute watchdog for durable background generations.
--
-- Vercel Cron on this plan only allows daily schedules, so pg_cron + pg_net
-- drives the watchdog instead: every minute Postgres POSTs to the internal
-- watchdog endpoint, which chains a replacement slice for each stalled job.
--
-- The callback token lives in private.internal_callback_secrets (inserted
-- out of band, never committed to git). Without it the poke is a no-op.

create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.internal_callback_secrets (
  name text primary key,
  secret text not null,
  updated_at timestamptz not null default now()
);

alter table private.internal_callback_secrets enable row level security;
revoke all on table private.internal_callback_secrets from public;
revoke all on table private.internal_callback_secrets from anon;
revoke all on table private.internal_callback_secrets from authenticated;

create or replace function public.poke_generations_watchdog()
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select secret into v_token
  from private.internal_callback_secrets
  where name = 'generations_internal_token';

  if v_token is null or v_token = '' then
    return null;
  end if;

  select net.http_post(
    'https://www.clauxen.com/api/v1/internal/generations/watchdog',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-clauxen-internal', v_token
    ),
    25000
  ) into v_request_id;

  -- Hygiene: pg_net keeps every response; prune ours daily.
  begin
    delete from net._http_response where created < now() - interval '1 day';
  exception when others then
    null;
  end;

  return v_request_id;
end;
$$;

revoke all on function public.poke_generations_watchdog() from public;
revoke execute on function public.poke_generations_watchdog() from anon;
revoke execute on function public.poke_generations_watchdog() from authenticated;
grant execute on function public.poke_generations_watchdog() to service_role;

-- Per-minute poke. Safe to re-run: replaces any previous schedule.
select cron.unschedule('generations-watchdog-every-minute')
where exists (
  select 1 from cron.job where jobname = 'generations-watchdog-every-minute'
);
select cron.schedule(
  'generations-watchdog-every-minute',
  '* * * * *',
  'select public.poke_generations_watchdog()'
);
