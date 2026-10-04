-- Server-side safety limits for the app's pooled `postgres` connections.
-- The Supavisor transaction pooler (6543) does not forward per-connection
-- startup GUCs from node-pg, so the client-side statement/idle timeouts were
-- silently ignored. Role-level settings apply to every backend the pooler
-- opens for this role. Per-transaction lock/statement limits are applied with
-- SET LOCAL inside withTransaction().
alter role postgres set idle_in_transaction_session_timeout = '15s';
alter role postgres set statement_timeout = '60s';
