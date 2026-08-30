-- Clauxen horizontal connector platform foundation.
-- Provider client secrets and end-user tokens are encrypted by the connector
-- gateway before they reach Postgres. Public schemas contain only safe catalog,
-- installation, permission, approval, health, and redacted audit metadata.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Existing connector catalog and installation lifecycle
-- ---------------------------------------------------------------------------

alter table public.connector_catalog
  drop constraint if exists connector_catalog_auth_type_check;

alter table public.connector_catalog
  add constraint connector_catalog_auth_type_check
  check (auth_type in ('oauth', 'oauth2', 'api_key', 'mcp_oauth2', 'none'));

alter table public.connector_catalog
  add column if not exists protocol text not null default 'rest',
  add column if not exists documentation_url text,
  add column if not exists capabilities jsonb not null default '[]'::jsonb;

alter table public.connector_catalog
  drop constraint if exists connector_catalog_protocol_check;

alter table public.connector_catalog
  add constraint connector_catalog_protocol_check
  check (protocol in ('rest', 'mcp', 'custom'));

alter table public.connector_installations
  drop constraint if exists connector_installations_status_check;

alter table public.connector_installations
  add constraint connector_installations_status_check
  check (status in (
    'pending', 'active', 'reauthorization_required', 'revoked', 'error'
  ));

alter table public.connector_installations
  add column if not exists provider_account_id text,
  add column if not exists account_label text,
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists connected_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_at timestamptz;

alter table public.connector_installations
  drop constraint if exists connector_installations_connector_id_user_id_workspace_id_key;

create unique index if not exists connector_installations_user_scope_uidx
on public.connector_installations (
  connector_id,
  user_id,
  coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index if not exists connector_installations_user_status_idx
on public.connector_installations (user_id, status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Tool registry and user policies
-- ---------------------------------------------------------------------------

create table if not exists public.connector_tools (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.connector_catalog(id) on delete cascade,
  name text not null,
  title text not null,
  description text not null default '',
  input_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  output_schema jsonb,
  http_method text,
  path_template text,
  request_config jsonb not null default '{}'::jsonb,
  risk_level text not null default 'read',
  requires_confirmation boolean not null default false,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connector_id, name),
  check (name ~ '^[a-z][a-z0-9_]{1,79}$'),
  check (http_method is null or http_method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  check (risk_level in ('read', 'write', 'destructive', 'sensitive'))
);

create index if not exists connector_tools_connector_enabled_idx
on public.connector_tools (connector_id, is_enabled, name);

create table if not exists public.connector_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.connector_installations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  policy text not null default 'inherit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, tool_name),
  check (policy in ('inherit', 'allow', 'confirm', 'deny'))
);

create index if not exists connector_tool_permissions_user_idx
on public.connector_tool_permissions (user_id, installation_id);

create table if not exists public.connector_action_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null references public.connector_installations(id) on delete cascade,
  tool_name text not null,
  arguments_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  decided_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status in ('pending', 'approved', 'denied', 'expired', 'consumed'))
);

create index if not exists connector_action_approvals_pending_idx
on public.connector_action_approvals (user_id, status, expires_at)
where status in ('pending', 'approved');

create table if not exists public.connector_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  installation_id uuid references public.connector_installations(id) on delete set null,
  connector_key text,
  event_type text not null,
  tool_name text,
  request_id text,
  status text not null,
  duration_ms integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (status in ('started', 'succeeded', 'failed', 'denied')),
  check (duration_ms is null or duration_ms >= 0)
);

create index if not exists connector_audit_events_user_created_idx
on public.connector_audit_events (user_id, created_at desc);

create index if not exists connector_audit_events_installation_created_idx
on public.connector_audit_events (installation_id, created_at desc);

create table if not exists public.connector_health_checks (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.connector_installations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  latency_ms integer,
  error_code text,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (status in ('healthy', 'degraded', 'reauthorization_required', 'unavailable')),
  check (latency_ms is null or latency_ms >= 0)
);

create index if not exists connector_health_checks_installation_idx
on public.connector_health_checks (installation_id, checked_at desc);

-- ---------------------------------------------------------------------------
-- Private OAuth configuration, transactions, and encrypted token vault
-- ---------------------------------------------------------------------------

create table if not exists private.connector_oauth_configs (
  connector_id uuid primary key references public.connector_catalog(id) on delete cascade,
  client_id text not null,
  encrypted_client_secret text,
  client_secret_nonce text,
  encryption_key_version integer not null default 1,
  authorization_endpoint text not null,
  token_endpoint text not null,
  revocation_endpoint text,
  api_base_url text,
  client_auth_method text not null default 'client_secret_post',
  scopes text[] not null default '{}',
  authorization_params jsonb not null default '{}'::jsonb,
  token_params jsonb not null default '{}'::jsonb,
  supports_pkce boolean not null default true,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  check (authorization_endpoint ~ '^https://'),
  check (token_endpoint ~ '^https://'),
  check (revocation_endpoint is null or revocation_endpoint ~ '^https://'),
  check (api_base_url is null or api_base_url ~ '^https://'),
  check (
    client_auth_method = 'none'
    or (encrypted_client_secret is not null and client_secret_nonce is not null)
  )
);

create table if not exists private.connector_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  connector_id uuid not null references public.connector_catalog(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  encrypted_code_verifier text not null,
  code_verifier_nonce text not null,
  redirect_uri text not null,
  return_url text not null,
  requested_scopes text[] not null default '{}',
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status in ('pending', 'consumed', 'failed', 'expired')),
  check (redirect_uri ~ '^https://'),
  check (return_url ~ '^https://')
);

create index if not exists connector_oauth_transactions_expiry_idx
on private.connector_oauth_transactions (status, expires_at);

create table if not exists private.connector_credentials (
  installation_id uuid primary key references public.connector_installations(id) on delete cascade,
  encrypted_access_token text not null,
  access_token_nonce text not null,
  encrypted_refresh_token text,
  refresh_token_nonce text,
  encryption_key_version integer not null default 1,
  token_type text not null default 'Bearer',
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  provider_account_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  refresh_lock_id uuid,
  refresh_locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (encrypted_refresh_token is null and refresh_token_nonce is null)
    or (encrypted_refresh_token is not null and refresh_token_nonce is not null)
  )
);

create index if not exists connector_credentials_expiry_idx
on private.connector_credentials (expires_at)
where expires_at is not null;

-- Atomic one-time OAuth state consumption. The encrypted PKCE verifier is
-- returned only to the trusted connector runtime.
create or replace function private.claim_connector_oauth_transaction(
  p_state_hash text,
  p_connector_key text
)
returns table (
  id uuid,
  connector_id uuid,
  user_id uuid,
  workspace_id uuid,
  encrypted_code_verifier text,
  code_verifier_nonce text,
  redirect_uri text,
  return_url text,
  requested_scopes text[]
)
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  update private.connector_oauth_transactions tx
  set status = 'consumed', consumed_at = now()
  from public.connector_catalog catalog
  where tx.connector_id = catalog.id
    and tx.state_hash = p_state_hash
    and catalog.key = p_connector_key
    and tx.status = 'pending'
    and tx.expires_at > now()
  returning tx.id, tx.connector_id, tx.user_id, tx.workspace_id,
            tx.encrypted_code_verifier, tx.code_verifier_nonce,
            tx.redirect_uri, tx.return_url, tx.requested_scopes;
$$;

create or replace function private.acquire_connector_refresh_lease(
  p_installation_id uuid,
  p_lock_id uuid,
  p_lease_seconds integer default 30
)
returns boolean
language sql
security invoker
set search_path = private, pg_temp
as $$
  with locked as (
    update private.connector_credentials
    set refresh_lock_id = p_lock_id,
        refresh_locked_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 5), 120))
    where installation_id = p_installation_id
      and (refresh_locked_until is null or refresh_locked_until < now())
    returning 1
  )
  select exists(select 1 from locked);
$$;

create or replace function private.release_connector_refresh_lease(
  p_installation_id uuid,
  p_lock_id uuid
)
returns void
language sql
security invoker
set search_path = private, pg_temp
as $$
  update private.connector_credentials
  set refresh_lock_id = null, refresh_locked_until = null
  where installation_id = p_installation_id
    and refresh_lock_id = p_lock_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS, grants, and updated_at triggers
-- ---------------------------------------------------------------------------

select public.ensure_updated_at_trigger('public.connector_catalog'::regclass);
select public.ensure_updated_at_trigger('public.connector_installations'::regclass);
select public.ensure_updated_at_trigger('public.connector_tools'::regclass);
select public.ensure_updated_at_trigger('public.connector_tool_permissions'::regclass);
select public.ensure_updated_at_trigger('private.connector_oauth_configs'::regclass);
select public.ensure_updated_at_trigger('private.connector_credentials'::regclass);

alter table public.connector_tools enable row level security;
alter table public.connector_tool_permissions enable row level security;
alter table public.connector_action_approvals enable row level security;
alter table public.connector_audit_events enable row level security;
alter table public.connector_health_checks enable row level security;

drop policy if exists connector_installations_owner_manage on public.connector_installations;
drop policy if exists connector_installations_owner_read on public.connector_installations;
drop policy if exists connector_installations_service_role_all on public.connector_installations;

create policy connector_installations_owner_read
on public.connector_installations for select to authenticated
using (user_id = (select auth.uid()));

create policy connector_installations_service_role_all
on public.connector_installations for all to service_role
using (true) with check (true);

drop policy if exists connector_tools_authenticated_read on public.connector_tools;
drop policy if exists connector_tools_service_role_all on public.connector_tools;

create policy connector_tools_authenticated_read
on public.connector_tools for select to authenticated
using (
  is_enabled
  and exists (
    select 1 from public.connector_catalog catalog
    where catalog.id = connector_tools.connector_id
      and catalog.status in ('active', 'beta')
  )
);

create policy connector_tools_service_role_all
on public.connector_tools for all to service_role
using (true) with check (true);

create policy connector_tool_permissions_owner_read
on public.connector_tool_permissions for select to authenticated
using (user_id = (select auth.uid()));

create policy connector_tool_permissions_service_role_all
on public.connector_tool_permissions for all to service_role
using (true) with check (true);

create policy connector_action_approvals_owner_read
on public.connector_action_approvals for select to authenticated
using (user_id = (select auth.uid()));

create policy connector_action_approvals_service_role_all
on public.connector_action_approvals for all to service_role
using (true) with check (true);

create policy connector_audit_events_owner_read
on public.connector_audit_events for select to authenticated
using (user_id = (select auth.uid()));

create policy connector_audit_events_service_role_all
on public.connector_audit_events for all to service_role
using (true) with check (true);

create policy connector_health_checks_owner_read
on public.connector_health_checks for select to authenticated
using (user_id = (select auth.uid()));

create policy connector_health_checks_service_role_all
on public.connector_health_checks for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.connector_installations from anon, authenticated;
revoke insert, update, delete on public.connector_tools from anon, authenticated;
revoke insert, update, delete on public.connector_tool_permissions from anon, authenticated;
revoke insert, update, delete on public.connector_action_approvals from anon, authenticated;
revoke insert, update, delete on public.connector_audit_events from anon, authenticated;
revoke insert, update, delete on public.connector_health_checks from anon, authenticated;

grant select on public.connector_catalog, public.connector_tools to authenticated;
grant select on public.connector_installations, public.connector_tool_permissions,
  public.connector_action_approvals, public.connector_audit_events,
  public.connector_health_checks to authenticated;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on function private.claim_connector_oauth_transaction(text, text)
  from public, anon, authenticated;
revoke all on function private.acquire_connector_refresh_lease(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function private.release_connector_refresh_lease(uuid, uuid)
  from public, anon, authenticated;

grant usage on schema private to service_role;
grant all on private.connector_oauth_configs,
  private.connector_oauth_transactions,
  private.connector_credentials to service_role;
grant execute on function private.claim_connector_oauth_transaction(text, text)
  to service_role;
grant execute on function private.acquire_connector_refresh_lease(uuid, uuid, integer)
  to service_role;
grant execute on function private.release_connector_refresh_lease(uuid, uuid)
  to service_role;

comment on table private.connector_oauth_configs is
  'Clauxen-owned provider OAuth clients. Secrets are application-encrypted before storage.';
comment on table private.connector_credentials is
  'Per-installation encrypted provider tokens; never exposed through the Data API.';
comment on table public.connector_audit_events is
  'Redacted connector security and tool execution audit trail. Never store raw tokens, arguments, or outputs.';
