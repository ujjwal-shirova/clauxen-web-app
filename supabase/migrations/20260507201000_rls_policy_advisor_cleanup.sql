-- =============================================================================
-- Migration: 20260507201000_rls_policy_advisor_cleanup
-- Purpose: Satisfy Supabase Security Advisor "RLS enabled but no policy" by
--          adding explicit least-privilege policies on operational tables.
-- Prerequisites:
--   - public.rate_limits, razorpay_webhook_events, webhook_events,
--     workspace_roles exist with RLS enabled.
-- Apply-time behavior:
--   - service_role ALL policies on backend-only webhook/rate-limit tables.
--   - workspace_roles: service_role full access + authenticated member read.
-- Security / RLS:
--   - rate_limits / webhook tables: no authenticated access; edge workers use
--     service_role bypass or SECURITY DEFINER paths.
--   - workspace_roles: members/owners can SELECT role rows for workspaces they
--     belong to; writes remain service_role-only via separate policies elsewhere.
-- Rollback guidance:
--   - DROP POLICY for each policy created; advisor warnings may return.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Backend-only tables: service_role full access
-- -----------------------------------------------------------------------------

drop policy if exists "rate_limits_service_role_all" on public.rate_limits;

create policy "rate_limits_service_role_all"
on public.rate_limits
for all
to service_role
using (true)
with check (true);

drop policy if exists "razorpay_webhook_events_service_role_all" on public.razorpay_webhook_events;

create policy "razorpay_webhook_events_service_role_all"
on public.razorpay_webhook_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "webhook_events_service_role_all" on public.webhook_events;

create policy "webhook_events_service_role_all"
on public.webhook_events
for all
to service_role
using (true)
with check (true);

-- -----------------------------------------------------------------------------
-- workspace_roles: service_role writes + member read
-- -----------------------------------------------------------------------------

drop policy if exists "workspace_roles_service_role_all" on public.workspace_roles;

create policy "workspace_roles_service_role_all"
on public.workspace_roles
for all
to service_role
using (true)
with check (true);

drop policy if exists "workspace_roles_member_read" on public.workspace_roles;

-- Authenticated users may read role definitions for workspaces they own or
-- actively belong to (used for UI permission hints, not privilege elevation).
create policy "workspace_roles_member_read"
on public.workspace_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_roles.workspace_id
      and workspaces.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = workspace_roles.workspace_id
      and workspace_members.user_id = auth.uid()
      and workspace_members.status = 'active'
  )
);
