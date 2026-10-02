-- MCP plugin connections — per-user installs with OAuth tokens.
--
-- Clicking "Add to Clauxen" on a marketplace plugin starts an MCP OAuth 2.1
-- authorization in a new tab (handled by the clauxen-plugin-oauth Cloudflare
-- worker). When the provider redirects back, the worker exchanges the code and
-- writes the resulting tokens here. The chat agent then uses those tokens to
-- call the plugin's MCP server tool-by-tool.
--
-- Public schema holds only safe, redacted connection metadata. Access and
-- refresh tokens live exclusively in private.plugin_oauth_tokens and are
-- sealed (AES-256-GCM) before they reach Postgres.

create table if not exists public.plugin_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Marketplace identity (catalog id, e.g. "gmail").
  plugin_id text not null,
  plugin_name text not null default '',
  plugin_icon_url text,

  -- The remote MCP server this connection talks to (Streamable HTTP).
  mcp_url text not null,
  auth_type text not null default 'mcp_oauth2',

  status text not null default 'pending',

  -- OAuth outcome metadata (redacted — never the tokens themselves).
  authorization_server text,
  provider_account_id text,
  granted_scopes text[] not null default '{}',

  connected_at timestamptz,
  last_used_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plugin_connections_plugin_id_check
    check (char_length(plugin_id) between 1 and 200),
  constraint plugin_connections_mcp_url_check
    check (mcp_url ~ '^https://'),
  constraint plugin_connections_auth_type_check
    check (auth_type in ('mcp_oauth2', 'none')),
  constraint plugin_connections_status_check
    check (status in ('pending', 'active', 'reauthorization_required', 'revoked', 'error'))
);

-- One connection per user per plugin.
create unique index if not exists plugin_connections_user_plugin_uidx
on public.plugin_connections (user_id, plugin_id);

create index if not exists plugin_connections_user_status_idx
on public.plugin_connections (user_id, status, updated_at desc);

select public.ensure_updated_at_trigger('public.plugin_connections'::regclass);

alter table public.plugin_connections enable row level security;

drop policy if exists plugin_connections_owner_read on public.plugin_connections;
drop policy if exists plugin_connections_owner_write on public.plugin_connections;
drop policy if exists plugin_connections_service_role_all on public.plugin_connections;

create policy plugin_connections_owner_read
on public.plugin_connections for select to authenticated
using (user_id = (select auth.uid()));

create policy plugin_connections_owner_write
on public.plugin_connections for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy plugin_connections_service_role_all
on public.plugin_connections for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.plugin_connections from anon;
grant select on public.plugin_connections to authenticated;

comment on table public.plugin_connections is
  'Per-user MCP plugin connections. Token material lives in private.plugin_oauth_tokens, never here.';

-- ---------------------------------------------------------------------------
-- Sealed OAuth tokens (private)
-- ---------------------------------------------------------------------------

create table if not exists private.plugin_oauth_tokens (
  connection_id uuid primary key references public.plugin_connections(id) on delete cascade,

  -- AES-256-GCM sealed blobs: "v1.<iv>.<tag>.<ciphertext>" (base64url).
  access_token_sealed text not null,
  refresh_token_sealed text,
  token_type text not null default 'Bearer',
  expires_at timestamptz,
  scopes text[] not null default '{}',

  -- Provider-specific extra fields from the token response, minus secrets.
  raw_extras jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.ensure_updated_at_trigger('private.plugin_oauth_tokens'::regclass);

revoke all on private.plugin_oauth_tokens from public, anon, authenticated;
grant all on private.plugin_oauth_tokens to service_role;

comment on table private.plugin_oauth_tokens is
  'Sealed MCP OAuth token material. Only the app runtime unseals it per tool call; never returned to any client.';

-- ---------------------------------------------------------------------------
-- Connection tool cache — discovered MCP tools per connection
-- ---------------------------------------------------------------------------

create table if not exists public.plugin_connection_tools (
  connection_id uuid not null references public.plugin_connections(id) on delete cascade,
  tool_name text not null,
  title text not null default '',
  description text not null default '',
  input_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  is_enabled boolean not null default true,
  discovered_at timestamptz not null default now(),
  primary key (connection_id, tool_name),
  constraint plugin_connection_tools_name_check
    check (char_length(tool_name) between 1 and 200)
);

select public.ensure_updated_at_trigger('public.plugin_connection_tools'::regclass);

alter table public.plugin_connection_tools enable row level security;

drop policy if exists plugin_connection_tools_owner_read on public.plugin_connection_tools;
drop policy if exists plugin_connection_tools_service_role_all on public.plugin_connection_tools;

create policy plugin_connection_tools_owner_read
on public.plugin_connection_tools for select to authenticated
using (
  exists (
    select 1 from public.plugin_connections pc
    where pc.id = plugin_connection_tools.connection_id
      and pc.user_id = (select auth.uid())
  )
);

create policy plugin_connection_tools_service_role_all
on public.plugin_connection_tools for all to service_role
using (true) with check (true);

revoke insert, update, delete on public.plugin_connection_tools from anon, authenticated;
grant select on public.plugin_connection_tools to authenticated;

comment on table public.plugin_connection_tools is
  'Cached tools/list result for a connected MCP server, refreshed when the connection is used.';

-- ---------------------------------------------------------------------------
-- Service-role RPCs — the only way in or out of private.plugin_oauth_tokens
-- ---------------------------------------------------------------------------
-- PostgREST only exposes the public schema, so the plugin-oauth worker writes
-- sealed token material through these security-definer functions. They are
-- revoked from every role except service_role, so no signed-in client can ever
-- read a token.

create or replace function public.plugin_oauth_complete(
  p_user_id uuid,
  p_plugin_id text,
  p_plugin_name text,
  p_plugin_icon_url text,
  p_mcp_url text,
  p_auth_type text,
  p_status text,
  p_authorization_server text,
  p_granted_scopes text[],
  p_provider_account_id text,
  p_access_token_sealed text,
  p_refresh_token_sealed text,
  p_token_type text,
  p_expires_at timestamptz,
  p_token_scopes text[]
) returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_connection_id uuid;
begin
  insert into public.plugin_connections (
    user_id, plugin_id, plugin_name, plugin_icon_url, mcp_url, auth_type,
    status, authorization_server, granted_scopes, provider_account_id, connected_at
  ) values (
    p_user_id, p_plugin_id, p_plugin_name, p_plugin_icon_url, p_mcp_url, p_auth_type,
    p_status, p_authorization_server, p_granted_scopes, p_provider_account_id,
    case when p_status = 'active' then now() else null end
  )
  on conflict (user_id, plugin_id) do update set
    plugin_name = excluded.plugin_name,
    plugin_icon_url = excluded.plugin_icon_url,
    mcp_url = excluded.mcp_url,
    auth_type = excluded.auth_type,
    status = excluded.status,
    authorization_server = excluded.authorization_server,
    granted_scopes = excluded.granted_scopes,
    provider_account_id = excluded.provider_account_id,
    connected_at = coalesce(public.plugin_connections.connected_at, excluded.connected_at),
    last_error_code = null,
    last_error_at = null,
    updated_at = now()
  returning id into v_connection_id;

  insert into private.plugin_oauth_tokens (
    connection_id, access_token_sealed, refresh_token_sealed, token_type,
    expires_at, scopes
  ) values (
    v_connection_id, p_access_token_sealed, p_refresh_token_sealed, p_token_type,
    p_expires_at, p_token_scopes
  )
  on conflict (connection_id) do update set
    access_token_sealed = excluded.access_token_sealed,
    refresh_token_sealed = coalesce(
      excluded.refresh_token_sealed,
      private.plugin_oauth_tokens.refresh_token_sealed
    ),
    token_type = excluded.token_type,
    expires_at = excluded.expires_at,
    scopes = excluded.scopes,
    updated_at = now();

  return v_connection_id;
end;
$$;

create or replace function public.plugin_oauth_read_refresh(
  p_connection_id uuid
) returns table (
  connection_id uuid,
  user_id uuid,
  plugin_id text,
  mcp_url text,
  refresh_token_sealed text,
  authorization_server text,
  granted_scopes text[]
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select c.id, c.user_id, c.plugin_id, c.mcp_url, t.refresh_token_sealed,
         c.authorization_server, c.granted_scopes
    from public.plugin_connections c
    join private.plugin_oauth_tokens t on t.connection_id = c.id
   where c.id = p_connection_id;
$$;

create or replace function public.plugin_oauth_rotate(
  p_connection_id uuid,
  p_access_token_sealed text,
  p_refresh_token_sealed text,
  p_token_type text,
  p_expires_at timestamptz,
  p_token_scopes text[]
) returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  update private.plugin_oauth_tokens
     set access_token_sealed = p_access_token_sealed,
         refresh_token_sealed = coalesce(p_refresh_token_sealed, refresh_token_sealed),
         token_type = p_token_type,
         expires_at = p_expires_at,
         scopes = p_token_scopes,
         updated_at = now()
   where connection_id = p_connection_id;
$$;

revoke all on function public.plugin_oauth_complete(uuid, text, text, text, text, text, text, text, text[], text, text, text, text, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.plugin_oauth_read_refresh(uuid) from public, anon, authenticated;
revoke all on function public.plugin_oauth_rotate(uuid, text, text, text, timestamptz, text[]) from public, anon, authenticated;

grant execute on function public.plugin_oauth_complete(uuid, text, text, text, text, text, text, text, text[], text, text, text, text, timestamptz, text[]) to service_role;
grant execute on function public.plugin_oauth_read_refresh(uuid) to service_role;
grant execute on function public.plugin_oauth_rotate(uuid, text, text, text, timestamptz, text[]) to service_role;
