-- Local MCP OAuth returns to the Next.js app on http://localhost:9002.
-- The worker already allowlists localhost HTTP; this check must match.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'private'
      and rel.relname = 'connector_oauth_transactions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~ 'return_url'
  loop
    execute format(
      'alter table private.connector_oauth_transactions drop constraint if exists %I',
      constraint_name
    );
  end loop;
end
$$;

alter table private.connector_oauth_transactions
  add constraint connector_oauth_transactions_return_url_check
  check (
    return_url ~ '^https://'
    or return_url ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/'
  );
