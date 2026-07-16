-- Align live schema with application repositories (projects.system_prompt + user_skills).
-- Companion to dashboard hardening; keeps local migrations in sync with production.

-- 1) Project instructions column expected by projects.repository.ts
alter table public.projects
  add column if not exists system_prompt text;

comment on column public.projects.system_prompt is
  'Optional project-level instructions appended to the model system prompt.';

-- 2) Replace stub user_skills (skill/level) with R2 skill-pack schema used by the app
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_skills'
      and column_name = 'skill'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_skills'
      and column_name = 'name'
  ) then
    drop table public.user_skills cascade;
  end if;
end $$;

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  storage_bucket text not null,
  storage_prefix text not null,
  source_format text not null default 'zip',
  primary_object_key text,
  status text not null default 'active'
    check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_skills_user_id_idx
  on public.user_skills (user_id, updated_at desc);

alter table public.user_skills enable row level security;

grant select, insert, update, delete on public.user_skills to authenticated;
grant all on public.user_skills to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_skills' and policyname = 'own_user_skills_select'
  ) then
    create policy "own_user_skills_select"
      on public.user_skills for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_skills' and policyname = 'own_user_skills_insert'
  ) then
    create policy "own_user_skills_insert"
      on public.user_skills for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_skills' and policyname = 'own_user_skills_update'
  ) then
    create policy "own_user_skills_update"
      on public.user_skills for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_skills' and policyname = 'own_user_skills_delete'
  ) then
    create policy "own_user_skills_delete"
      on public.user_skills for delete to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;

-- 3) user_settings has no `id` column — avoid Realtime filter-id errors
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime drop table public.user_settings;
  end if;
end $$;
