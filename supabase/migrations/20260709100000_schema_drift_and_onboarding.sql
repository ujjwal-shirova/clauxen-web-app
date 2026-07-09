-- Onboarding state on user_settings
alter table public.user_settings
  add column if not exists onboarding_step text default 'welcome',
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.user_settings.onboarding_step is
  'Current onboarding wizard step key (welcome, name, role, etc.).';
comment on column public.user_settings.onboarding_completed_at is
  'When set, user has finished first-run onboarding.';

-- project_files — matches project-files.repository.ts
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  content_hash text,
  status text not null default 'processing'
    check (status in ('pending', 'processing', 'ready', 'failed', 'deleted')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists project_files_project_id_idx
  on public.project_files (project_id, created_at desc);

-- user_skills — matches user-skills.repository.ts
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
