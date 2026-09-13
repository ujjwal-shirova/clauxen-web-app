-- Self-hosted API keys for key-gated MCP servers (gateway-less installs).
-- Sealed by Next.js (see src/server/plugins/api-key-crypto.ts); the worker
-- never reads this table. Gateway-mode API keys live in
-- private.connector_credentials instead (worker-sealed).

create table if not exists private.plugin_mcp_api_keys (
  installation_id uuid primary key references public.connector_installations(id) on delete cascade,
  encrypted_api_key text not null,
  api_key_nonce text not null,
  encryption_key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public.ensure_updated_at_trigger('private.plugin_mcp_api_keys'::regclass);

revoke all on private.plugin_mcp_api_keys from public, anon, authenticated;
grant all on private.plugin_mcp_api_keys to service_role;

comment on table private.plugin_mcp_api_keys is
  'Next-sealed API keys for gateway-less MCP installs. Never exposed; only the server runtime unseals them per tool call.';
