-- Drop Realtime publication for tables without an `id` column.
-- Clients/filters that assume `id=eq.…` produce "invalid column for filter id".

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_branch_states'
  ) then
    alter publication supabase_realtime drop table public.chat_branch_states;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_balances'
  ) then
    alter publication supabase_realtime drop table public.user_balances;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime drop table public.user_settings;
  end if;
end $$;
