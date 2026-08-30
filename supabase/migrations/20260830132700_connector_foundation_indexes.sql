-- Cover connector foreign keys used by cleanup, ownership, and cascade operations.
create index if not exists connector_oauth_transactions_connector_idx
  on private.connector_oauth_transactions (connector_id);

create index if not exists connector_oauth_transactions_user_idx
  on private.connector_oauth_transactions (user_id);

create index if not exists connector_oauth_transactions_workspace_idx
  on private.connector_oauth_transactions (workspace_id)
  where workspace_id is not null;

create index if not exists connector_action_approvals_installation_idx
  on public.connector_action_approvals (installation_id);

create index if not exists connector_audit_events_workspace_created_idx
  on public.connector_audit_events (workspace_id, created_at desc)
  where workspace_id is not null;

create index if not exists connector_health_checks_user_checked_idx
  on public.connector_health_checks (user_id, checked_at desc);

-- This index duplicates the pre-existing connector_installations_user_idx.
drop index if exists public.connector_installations_user_status_idx;
