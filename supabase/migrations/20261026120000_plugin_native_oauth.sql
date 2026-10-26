-- Native provider OAuth for plugins.
--
-- Connecting a plugin now always sends the user to the provider's own consent
-- screen (Google, GitHub, Slack, Microsoft, or the authorization server named
-- by a remote MCP server's RFC 9728 metadata). The app exchanges the returned
-- code for real tokens; nothing is ever minted locally.
--
-- Pending authorizations live in Postgres (not process memory) so the start
-- and callback can land on different Cloudflare isolates. State is stored as
-- a SHA-256 hash, single-use, bound to the signed-in user, and expires after
-- ten minutes.

-- ---------------------------------------------------------------------------
-- Connections: connector kind, permission mode, linked account
-- ---------------------------------------------------------------------------

alter table public.plugin_connections
  add column if not exists connector_kind text not null default 'mcp',
  add column if not exists permission_mode text not null default 'read_write',
  add column if not exists account_label text;

alter table public.plugin_connections alter column mcp_url drop not null;

alter table public.plugin_connections
  drop constraint if exists plugin_connections_mcp_url_check,
  drop constraint if exists plugin_connections_auth_type_check,
  drop constraint if exists plugin_connections_connector_kind_check,
  drop constraint if exists plugin_connections_permission_mode_check;

alter table public.plugin_connections
  add constraint plugin_connections_mcp_url_check
    check (mcp_url is null or mcp_url ~ '^https://'),
  add constraint plugin_connections_auth_type_check
    check (auth_type in ('mcp_oauth2', 'oauth2', 'none')),
  add constraint plugin_connections_connector_kind_check
    check (connector_kind in ('mcp', 'rest')),
  add constraint plugin_connections_permission_mode_check
    check (permission_mode in ('read_only', 'read_write'));

-- Signed-in users may read their own rows but every write goes through the
-- server, which enforces the connection lifecycle.
drop policy if exists plugin_connections_owner_write on public.plugin_connections;
revoke insert, update, delete on public.plugin_connections from authenticated;

-- ---------------------------------------------------------------------------
-- Token metadata needed for refresh and revocation
-- ---------------------------------------------------------------------------

alter table private.plugin_oauth_tokens
  add column if not exists oauth_meta jsonb not null default '{}'::jsonb,
  add column if not exists client_secret_sealed text;

comment on column private.plugin_oauth_tokens.oauth_meta is
  'Non-secret refresh/revocation metadata: token endpoint, client id, issuer, resource, provider.';

-- ---------------------------------------------------------------------------
-- Pending authorizations (replaces the in-memory map)
-- ---------------------------------------------------------------------------

create table if not exists private.plugin_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id text not null,
  -- AES-256-GCM sealed JSON: PKCE verifier, client credentials, endpoints.
  payload_sealed text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint plugin_oauth_states_hash_check check (char_length(state_hash) = 64)
);

create index if not exists plugin_oauth_states_expires_idx
on private.plugin_oauth_states (expires_at);

revoke all on private.plugin_oauth_states from public, anon, authenticated;
grant all on private.plugin_oauth_states to service_role;

-- ---------------------------------------------------------------------------
-- Dynamically registered OAuth clients (RFC 7591), one per issuer
-- ---------------------------------------------------------------------------

create table if not exists private.plugin_oauth_clients (
  issuer text not null,
  redirect_uri text not null,
  client_id text not null,
  client_secret_sealed text,
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now(),
  primary key (issuer, redirect_uri)
);

revoke all on private.plugin_oauth_clients from public, anon, authenticated;
grant all on private.plugin_oauth_clients to service_role;

-- ---------------------------------------------------------------------------
-- Tool risk levels
-- ---------------------------------------------------------------------------

alter table public.plugin_connection_tools
  add column if not exists risk_level text not null default 'write';

alter table public.plugin_connection_tools
  drop constraint if exists plugin_connection_tools_risk_level_check;

alter table public.plugin_connection_tools
  add constraint plugin_connection_tools_risk_level_check
    check (risk_level in ('read', 'write', 'destructive'));

-- ---------------------------------------------------------------------------
-- Resources and prompts a connected MCP server exposes
-- ---------------------------------------------------------------------------

create table if not exists public.plugin_connection_capabilities (
  connection_id uuid not null references public.plugin_connections(id) on delete cascade,
  kind text not null,
  name text not null,
  title text not null default '',
  description text not null default '',
  uri text,
  discovered_at timestamptz not null default now(),
  primary key (connection_id, kind, name),
  constraint plugin_connection_capabilities_kind_check
    check (kind in ('resource', 'prompt')),
  constraint plugin_connection_capabilities_name_check
    check (char_length(name) between 1 and 300)
);

alter table public.plugin_connection_capabilities enable row level security;

drop policy if exists plugin_connection_capabilities_owner_read on public.plugin_connection_capabilities;
drop policy if exists plugin_connection_capabilities_service_role_all on public.plugin_connection_capabilities;

create policy plugin_connection_capabilities_owner_read
on public.plugin_connection_capabilities for select to authenticated
using (
  exists (
    select 1 from public.plugin_connections pc
    where pc.id = plugin_connection_capabilities.connection_id
      and pc.user_id = (select auth.uid())
  )
);

create policy plugin_connection_capabilities_service_role_all
on public.plugin_connection_capabilities for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.plugin_connection_capabilities from anon, authenticated;
grant select on public.plugin_connection_capabilities to authenticated;

-- ---------------------------------------------------------------------------
-- Tool-call trace. Arguments and results are never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.plugin_tool_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.plugin_connections(id) on delete set null,
  plugin_id text not null,
  tool_name text not null,
  risk_level text not null default 'write',
  status text not null,
  detail text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  constraint plugin_tool_calls_status_check
    check (status in ('ok', 'error', 'blocked')),
  constraint plugin_tool_calls_risk_level_check
    check (risk_level in ('read', 'write', 'destructive'))
);

create index if not exists plugin_tool_calls_user_created_idx
on public.plugin_tool_calls (user_id, created_at desc);

create index if not exists plugin_tool_calls_connection_created_idx
on public.plugin_tool_calls (connection_id, created_at desc);

alter table public.plugin_tool_calls enable row level security;

drop policy if exists plugin_tool_calls_owner_read on public.plugin_tool_calls;
drop policy if exists plugin_tool_calls_service_role_all on public.plugin_tool_calls;

create policy plugin_tool_calls_owner_read
on public.plugin_tool_calls for select to authenticated
using (user_id = (select auth.uid()));

create policy plugin_tool_calls_service_role_all
on public.plugin_tool_calls for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.plugin_tool_calls from anon, authenticated;
grant select on public.plugin_tool_calls to authenticated;

-- ---------------------------------------------------------------------------
-- Retire connections created by the old self-hosted consent page. Their
-- tokens were generated locally and never worked against a provider.
-- ---------------------------------------------------------------------------

delete from private.plugin_oauth_tokens t
using public.plugin_connections c
where t.connection_id = c.id
  and c.authorization_server = 'https://clauxen.com';

update public.plugin_connections
   set status = 'revoked',
       updated_at = now()
 where authorization_server = 'https://clauxen.com'
   and status <> 'revoked';
