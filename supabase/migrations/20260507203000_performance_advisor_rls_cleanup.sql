-- =============================================================================
-- Migration: 20260507203000_performance_advisor_rls_cleanup
-- Purpose: Performance Advisor RLS optimizations:
--   1) Rewrite auth.uid() to (select auth.uid()) in all public policies so the
--      planner evaluates JWT once per statement, not per row.
--   2) Split workspace FOR ALL owner policies into action-specific INSERT/UPDATE/
--      DELETE policies to avoid duplicate SELECT evaluation for authenticated.
-- Prerequisites:
--   - public tables with existing RLS policies referencing auth.uid().
--   - workspace read policies from prior migrations remain after this runs.
-- Apply-time behavior:
--   - Dynamic DO loop recreates policies from pg_policies catalog.
--   - Drops workspaces_owner_write / workspace_*_owner_write; creates granular
--     owner_insert/update/delete policies.
-- Security / RLS:
--   - Semantically equivalent access; performance-only change for auth.uid().
-- Rollback guidance:
--   - Restore prior policy definitions from git (advisor may warn on FOR ALL).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Batch rewrite: auth.uid() -> (select auth.uid()) on all public policies
-- -----------------------------------------------------------------------------
do $$
declare
  p record;
  v_roles text;
  v_qual text;
  v_with_check text;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    v_roles := (
      select string_agg(quote_ident(role_name), ', ')
      from unnest(p.roles) as role_name
    );
    v_qual := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    v_with_check := replace(p.with_check, 'auth.uid()', '(select auth.uid())');

    execute format(
      'drop policy if exists %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );

    v_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      v_roles
    );

    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;

    if v_with_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_with_check);
    end if;

    execute v_sql;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- workspaces: replace FOR ALL owner_write with action-specific policies
-- -----------------------------------------------------------------------------
drop policy if exists "workspaces_owner_write" on public.workspaces;

drop policy if exists "workspaces_owner_insert" on public.workspaces;

create policy "workspaces_owner_insert"
on public.workspaces
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "workspaces_owner_update" on public.workspaces;

create policy "workspaces_owner_update"
on public.workspaces
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "workspaces_owner_delete" on public.workspaces;

create policy "workspaces_owner_delete"
on public.workspaces
for delete
to authenticated
using (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- workspace_members: action-specific owner policies
-- -----------------------------------------------------------------------------
drop policy if exists "workspace_members_owner_write" on public.workspace_members;

drop policy if exists "workspace_members_owner_insert" on public.workspace_members;

create policy "workspace_members_owner_insert"
on public.workspace_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

drop policy if exists "workspace_members_owner_update" on public.workspace_members;

create policy "workspace_members_owner_update"
on public.workspace_members
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

drop policy if exists "workspace_members_owner_delete" on public.workspace_members;

create policy "workspace_members_owner_delete"
on public.workspace_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

-- -----------------------------------------------------------------------------
-- workspace_settings: action-specific owner policies
-- -----------------------------------------------------------------------------
drop policy if exists "workspace_settings_owner_write" on public.workspace_settings;

drop policy if exists "workspace_settings_owner_insert" on public.workspace_settings;

create policy "workspace_settings_owner_insert"
on public.workspace_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_settings.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

drop policy if exists "workspace_settings_owner_update" on public.workspace_settings;

create policy "workspace_settings_owner_update"
on public.workspace_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_settings.workspace_id
      and w.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_settings.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

drop policy if exists "workspace_settings_owner_delete" on public.workspace_settings;

create policy "workspace_settings_owner_delete"
on public.workspace_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_settings.workspace_id
      and w.owner_id = (select auth.uid())
  )
);
