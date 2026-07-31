-- Durable, user-owned folder tree for the Library. R2 remains the binary
-- store; these rows provide names, hierarchy, ownership, and fast listing.
create table if not exists public.library_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint library_folders_parent_owner_fk
    foreign key (parent_id, user_id)
    references public.library_folders(id, user_id)
    on delete cascade,
  constraint library_folders_not_self_parent
    check (parent_id is null or parent_id <> id)
);

create unique index if not exists library_folders_root_name_uidx
  on public.library_folders (user_id, lower(name))
  where parent_id is null;

create unique index if not exists library_folders_child_name_uidx
  on public.library_folders (user_id, parent_id, lower(name))
  where parent_id is not null;

create index if not exists library_folders_user_parent_idx
  on public.library_folders (user_id, parent_id, updated_at desc);

alter table public.user_files
  add column if not exists folder_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_files_folder_owner_fk'
      and conrelid = 'public.user_files'::regclass
  ) then
    alter table public.user_files
      add constraint user_files_folder_owner_fk
      foreign key (folder_id, user_id)
      references public.library_folders(id, user_id)
      on delete set null (folder_id);
  end if;
end
$$;

create index if not exists user_files_user_folder_updated_idx
  on public.user_files (user_id, folder_id, updated_at desc)
  where status <> 'deleted';

comment on table public.library_folders is
  'User-owned virtual folders mirrored by R2 object-key prefixes.';
comment on column public.user_files.folder_id is
  'Current Library folder; R2 storage_path mirrors this folder UUID when moved.';
comment on table public.user_files is
  'User file metadata pointing at a private Cloudflare R2 object.';

alter table public.library_folders enable row level security;

drop policy if exists "own_library_folders" on public.library_folders;
create policy "own_library_folders" on public.library_folders
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.library_folders from anon;
grant select, insert, update, delete on table public.library_folders to authenticated;
grant select, insert, update, delete on table public.library_folders to service_role;

-- user_files predates explicit Data API grants; keep its existing access
-- model but ensure signed-in clients remain covered after Supabase's 2026
-- default-grant change. RLS still limits every row to auth.uid().
grant select, insert, update, delete on table public.user_files to authenticated;
grant select, insert, update, delete on table public.user_files to service_role;
