-- Store the current profile photo as an R2 object referenced from profiles.
alter table public.profiles
  add column if not exists avatar_file_id uuid,
  add column if not exists avatar_storage_bucket text,
  add column if not exists avatar_storage_path text,
  add column if not exists avatar_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_file_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_file_id_fkey
      foreign key (avatar_file_id)
      references public.user_files (id)
      on delete set null;
  end if;
end $$;

create index if not exists profiles_avatar_file_id_idx
  on public.profiles (avatar_file_id);

comment on column public.profiles.avatar_file_id is
  'user_files row for the current profile photo stored in Cloudflare R2.';
comment on column public.profiles.avatar_storage_bucket is
  'Cloudflare R2 bucket that holds the current profile photo.';
comment on column public.profiles.avatar_storage_path is
  'Object key of the current profile photo in Cloudflare R2.';
comment on column public.profiles.avatar_updated_at is
  'When the current profile photo was last replaced.';

update public.profiles as p
set
  avatar_file_id = f.id,
  avatar_storage_bucket = f.storage_bucket,
  avatar_storage_path = f.storage_path,
  avatar_updated_at = coalesce(p.avatar_updated_at, f.updated_at)
from (
  select distinct on (user_id)
    id,
    user_id,
    storage_bucket,
    storage_path,
    updated_at
  from public.user_files
  where status = 'uploaded'
    and coalesce(metadata->>'purpose', '') = 'avatar'
  order by user_id, updated_at desc
) as f
where p.id = f.user_id
  and p.avatar_file_id is null;
