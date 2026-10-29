-- =============================================================================
-- Projects: first-class columns + project-scoped memory
--
-- Project settings previously lived in `projects.metadata` jsonb, which made
-- them unindexable and untyped. Promote them to real columns, backfill from
-- metadata, and give `user_memories` an optional project scope so a project
-- can own editable memory notes without a parallel memory store.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) projects: promote metadata keys to typed columns
-- -----------------------------------------------------------------------------
-- `description` and `system_prompt` already exist; `system_prompt` stays the
-- single source of truth for project instructions.
alter table public.projects
  add column if not exists memory_scope text not null default 'default',
  add column if not exists library_access text not null default 'enabled',
  add column if not exists pinned boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.projects
  drop constraint if exists projects_memory_scope_check;

alter table public.projects
  add constraint projects_memory_scope_check
  check (memory_scope in ('default', 'project'));

alter table public.projects
  drop constraint if exists projects_library_access_check;

alter table public.projects
  add constraint projects_library_access_check
  check (library_access in ('enabled', 'disabled'));

comment on column public.projects.description is
  'Short human description of the project, shown in the project gallery.';
comment on column public.projects.system_prompt is
  'Optional project-level instructions appended to the model system prompt.';
comment on column public.projects.memory_scope is
  'default = project may read memories from outside chats; project = isolated.';
comment on column public.projects.library_access is
  'Whether chats in this project may read the owner file library.';
comment on column public.projects.pinned is
  'Owner pinned the project to the top of the gallery.';
comment on column public.projects.archived_at is
  'Set when the owner archives the project; status moves to archived.';

-- Backfill the new columns from the legacy metadata keys.
update public.projects
set
  memory_scope = case
    when metadata->>'memory' = 'project' then 'project'
    else memory_scope
  end,
  library_access = case
    when metadata->>'libraryAccess' = 'disabled' then 'disabled'
    else library_access
  end,
  pinned = case
    when metadata->>'pinned' = 'true' then true
    else pinned
  end,
  icon = coalesce(nullif(icon, ''), metadata->>'iconId', 'folder'),
  color = coalesce(nullif(color, ''), '#14151a')
where metadata ?| array['memory', 'libraryAccess', 'pinned', 'iconId']
   or coalesce(icon, '') = ''
   or coalesce(color, '') = '';

update public.projects
set archived_at = updated_at
where status = 'archived' and archived_at is null;

-- Strip the migrated keys so metadata stops shadowing the columns.
update public.projects
set metadata = metadata - 'memory' - 'libraryAccess' - 'pinned' - 'iconId'
where metadata ?| array['memory', 'libraryAccess', 'pinned', 'iconId'];

-- Gallery read path: owner + lifecycle, pinned first, newest first.
create index if not exists projects_owner_browse_idx
  on public.projects (user_id, status, pinned desc, updated_at desc);

-- -----------------------------------------------------------------------------
-- 2) user_memories: optional project scope
-- -----------------------------------------------------------------------------
alter table public.user_memories
  add column if not exists project_id uuid
    references public.projects(id) on delete cascade;

comment on column public.user_memories.project_id is
  'Non-null for notes owned by a project; null rows are global user memory.';

create index if not exists user_memories_project_idx
  on public.user_memories (project_id, status, created_at desc)
  where project_id is not null;

-- Project source files are listed by (owner, project, purpose); without this
-- the dashboard sources panel sequentially scans user_files.
create index if not exists user_files_project_source_idx
  on public.user_files (user_id, project_id, created_at desc)
  where project_id is not null;
