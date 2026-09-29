-- Liveness signal for the generations watchdog driver.
--
-- The watchdog upserts one row per poke source on every pass, so operators
-- (and automation) can verify at a glance that the per-minute driver is
-- alive and which system is driving it. Cheap: one tiny upsert per minute.

create table if not exists private.watchdog_heartbeats (
  source text primary key,
  last_poke_at timestamptz not null default now(),
  last_result jsonb
);

alter table private.watchdog_heartbeats enable row level security;
revoke all on table private.watchdog_heartbeats from public;
revoke all on table private.watchdog_heartbeats from anon;
revoke all on table private.watchdog_heartbeats from authenticated;
grant all on table private.watchdog_heartbeats to service_role;
