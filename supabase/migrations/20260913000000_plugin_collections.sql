-- Self-hosted plugin collections (Saved tab).
-- Server-persisted bookmarks so saved plugins follow the user across devices.
-- The client keeps a localStorage mirror for logged-out use and instant paint.

create table if not exists public.plugin_collections (
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, plugin_id),
  check (char_length(plugin_id) between 1 and 200)
);

create index if not exists plugin_collections_user_created_idx
on public.plugin_collections (user_id, created_at desc);

alter table public.plugin_collections enable row level security;

drop policy if exists plugin_collections_owner_read on public.plugin_collections;
drop policy if exists plugin_collections_owner_write on public.plugin_collections;
drop policy if exists plugin_collections_service_role_all on public.plugin_collections;

create policy plugin_collections_owner_read
on public.plugin_collections for select to authenticated
using (user_id = (select auth.uid()));

create policy plugin_collections_owner_write
on public.plugin_collections for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy plugin_collections_service_role_all
on public.plugin_collections for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.plugin_collections from anon;
grant select, insert, delete on public.plugin_collections to authenticated;

comment on table public.plugin_collections is
  'Per-user saved MCP gallery plugins. plugin_id references scripts/chatgpt-plugins/plugins.json ids.';
