-- Retire the pg_cron watchdog driver.
--
-- The per-minute poke moved to the Cloudflare `clauxen-generations-watchdog`
-- worker (see workers/generations-watchdog). The poke function and the
-- private callback secret stay in place as a manual fallback:
--   select public.poke_generations_watchdog();

select cron.unschedule('generations-watchdog-every-minute')
where exists (
  select 1 from cron.job where jobname = 'generations-watchdog-every-minute'
);
