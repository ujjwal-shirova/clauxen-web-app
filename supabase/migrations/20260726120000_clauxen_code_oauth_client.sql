-- Seed Clauxen Code CLI first-party OAuth client + scopes.
-- Idempotent: safe to re-run.

insert into public.oauth_scopes (key, description, claim_names, is_default, is_sensitive)
values
  ('code:inference', 'Run Clauxen Code CLI inference against your account balance.', array[]::text[], false, true),
  ('code:profile', 'Read Clauxen account profile for the Code CLI.', array['name', 'email', 'picture'], false, false),
  -- Legacy Claude Code scope names still present in the bundled CLI runtime
  ('user:inference', 'Legacy alias for code:inference (Clauxen Code CLI bundle).', array[]::text[], false, true),
  ('user:profile', 'Legacy alias for code:profile (Clauxen Code CLI bundle).', array[]::text[], false, false),
  ('user:sessions:claude_code', 'Legacy CLI session scope (accepted, no-op).', array[]::text[], false, false),
  ('user:mcp_servers', 'Legacy MCP scope (accepted, no-op).', array[]::text[], false, false),
  ('user:file_upload', 'Legacy file upload scope (accepted, no-op).', array[]::text[], false, false),
  ('org:create_api_key', 'Legacy console scope (accepted, no-op).', array[]::text[], false, false)
on conflict (key) do update
set description = excluded.description,
    claim_names = excluded.claim_names,
    is_default = excluded.is_default,
    is_sensitive = excluded.is_sensitive;

-- Public PKCE client for the terminal CLI. Redirect URIs are loopback patterns
-- validated in application code (RFC 8252); stored here as documentation markers.
insert into public.oauth_clients (
  client_id,
  client_secret_hash,
  client_type,
  status,
  name,
  description,
  homepage_url,
  allowed_grant_types,
  allowed_response_types,
  require_pkce,
  first_party,
  metadata
)
values (
  'clauxen-code',
  null,
  'public',
  'active',
  'Clauxen Code',
  'Official Clauxen Code CLI. Sign in from your terminal to authorize local coding sessions.',
  'https://clauxen.com',
  array['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
  array['code'],
  true,
  true,
  jsonb_build_object(
    'loopbackRedirects', true,
    'product', 'clauxen-code'
  )
)
on conflict (client_id) do update
set status = 'active',
    client_type = 'public',
    require_pkce = true,
    first_party = true,
    name = excluded.name,
    description = excluded.description,
    homepage_url = excluded.homepage_url,
    allowed_grant_types = excluded.allowed_grant_types,
    allowed_response_types = excluded.allowed_response_types,
    metadata = excluded.metadata,
    updated_at = now(),
    deleted_at = null;

insert into public.oauth_client_redirect_uris (oauth_client_id, redirect_uri)
select c.id, u.redirect_uri
from public.oauth_clients c
cross join (
  values
    ('http://127.0.0.1/callback'),
    ('http://[::1]/callback')
) as u(redirect_uri)
where c.client_id = 'clauxen-code'
on conflict (oauth_client_id, redirect_uri) do nothing;
