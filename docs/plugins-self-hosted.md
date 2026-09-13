# Self-hosted plugins & MCP platform

Clauxen runs its **own** Model Context Protocol platform. No Pipedream, no
third-party connector cloud, no per-call broker in the middle. The Next.js app
owns the catalog and chat runtime; Postgres (Supabase) owns installs, tools,
approvals, and audit; a Cloudflare Worker adds OAuth when configured.

Two modes, same tables:

| Mode | Needs | Add works for |
|---|---|---|
| Full | Postgres + Worker env | OAuth + open + API-key plugins |
| Local-only | Postgres alone | Open + API-key plugins (OAuth gets a precise `connector_gateway_required` error, not a generic failure) |

Run `npm run plugins:setup` on any machine to see which mode you are in and
the exact fix for anything missing.

## Architecture

```
Browser  →  Next.js (Vercel)  →  connector-gateway (Cloudflare Worker, optional)  →  MCP server
  /plugins      /api/plugins        /v1/mcp/install (probe + OAuth + sync)
  Add button    /api/v1/plugins/*   /v1/tools/list + /v1/tools/call
  @mention      agent query-loop    /v1/oauth/* (DCR + CIMD + PKCE)
  API-key       local installer ────── direct when gateway env missing
  dialog        direct executor ──────┘
                    ↓
            scripts/.../plugins.json   Supabase Postgres
            1,977 verified MCP URLs    catalog / installs / tools /
                                       credentials (encrypted) / audit
```

### Catalog (no third party)

- `scripts/chatgpt-plugins/plugins.json` — 1,977 plugins with live-verified
  `mcpUrl` values. Source of truth for `/plugins`.
- `src/server/plugins/catalog.ts` — filters to verified MCP only, resolves
  bundled icons first (`src/shared/lib/plugins/local-icons.ts` → 134 files in
  `public/assets/plugins/`), then remote artwork, then letter avatars.
- `src/app/api/plugins/route.ts` — public paginated search (`?q=&category=
  &page=`), cached at the edge. `src/app/api/plugins/by-ids/route.ts` serves
  Saved-tab lookups.

### Install & OAuth (own gateway)

`POST /api/v1/plugins/install` uses the worker when `CONNECTOR_GATEWAY_*` is
set, else `src/server/plugins/install-local.ts` (same key derivation, same
tool sync, same tables). Both probe first (`WorkerMcpClient` /
`McpClient.probe()`):

1. **Probe** the MCP endpoint with `initialize` over Streamable HTTP
   (`Accept: application/json, text/event-stream`, `mcp-protocol-version`).
2. **No-auth servers** connect immediately and sync `tools/list` +
   `prompts/list` into `connector_tools` (tools capped at 200, skills at 50).
3. **OAuth servers** follow RFC 9728 protected-resource metadata → RFC 8414
   authorization-server metadata → registration:
   - **Client ID Metadata Documents** first when the AS advertises
     `client_id_metadata_document_supported` (2026 preferred path). The
     document is served by Clauxen itself at
     `/api/oauth/client-metadata/:connectorKey` — no registration POST, no
     secret.
   - **Dynamic Client Registration** (RFC 7591) as fallback, then
     Authorization Code + PKCE (S256) + resource indicators (RFC 8707).
4. Tokens are sealed with `CONNECTOR_ENCRYPTION_KEY` (per-install AAD) before
   Postgres. Raw tokens never touch the Next.js tier or logs.

### API-key servers (both modes)

Servers that 401 without OAuth metadata need a user key. Add returns
`plugin_api_key_required` and the UI opens a minimal key dialog; retrying
with a key probes with `Authorization: Bearer`, then stores it sealed:

- Gateway mode: worker-sealed into `private.connector_credentials`
  (requires worker deploy ≥ the apiKey support commit).
- Local mode: Next-sealed into `private.plugin_mcp_api_keys`
  (`src/server/plugins/api-key-crypto.ts`, AES-256-GCM, per-install AAD).
  Zero-config default derives the key from `SUPABASE_SERVICE_ROLE_KEY`;
  set `PLUGIN_CREDENTIAL_KEY` for breach separation. Re-installing with a
  new key rotates it; Remove wipes it.

### Chat runtime (agent tools)

- `src/server/mcp/registry.ts` (`McpConnectorHarness`) discovers the user's
  tools per turn (8s budget, failures skipped) — via the gateway when
  configured, else straight from Postgres with in-process calls — and exposes
  them as `mcp__<connectorKey>__<toolName>`.
- `src/server/agent-core/runtime/query-loop.ts` injects connected plugin names
  into the system prompt and routes `mcp__*` calls onward. Both executors
  enforce approvals (`write`/`destructive`/`sensitive` require confirmation),
  refresh OAuth tokens with a Postgres lease (gateway), cap direct output at
  100k chars, and audit every call.

### Saved collections (own backend)

- `public.plugin_collections (user_id, plugin_id)` — server-persisted Saved
  tab (`supabase/migrations/20260913000000_plugin_collections.sql`).
- `GET/POST/DELETE /api/v1/plugins/collection` — authenticated CRUD.
- `usePluginInstallations` merges server + `localStorage` so logged-out
  saves survive and logged-in saves sync across devices.

## Setup

Start here on any machine:

```sh
npm run plugins:setup
```

It checks the catalog, the 9 Postgres tables, and gateway reachability/auth,
prints your mode (full vs local-only), and the exact fix for each gap.

### 1. Supabase (Postgres)

```sh
supabase db push
```

Required tables ride with the repo: `connector_catalog`, `connector_tools`,
`connector_installations`, `connector_action_approvals`, `connector_audit_events`,
`private.connector_oauth_configs`, `private.connector_credentials`,
`private.connector_oauth_transactions`, `public.plugin_collections`,
`private.plugin_mcp_api_keys`, plus the
`claim_connector_oauth_transaction` / refresh-lease RPCs.

Env (Vercel → Sensitive, never `NEXT_PUBLIC_`):

- `DATABASE_URL` — Supabase transaction pooler (`:6543/postgres`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Connector gateway (Cloudflare Worker)

```sh
cd workers/connector-gateway
wrangler deploy
```

Secrets (Cloudflare only, never in git):

- `CONNECTOR_ENCRYPTION_KEY` — 32-byte base64url; seals OAuth secrets/tokens
- `CONNECTOR_GATEWAY_INTERNAL_TOKEN` — Vercel → Worker auth (match Vercel)
- `CONNECTOR_GATEWAY_ADMIN_TOKEN` — `PUT /v1/admin/connectors/*` tool config

Bindings (see `wrangler.jsonc`): Hyperdrive (Postgres), three rate limiters,
`clauxen-connector-events` queue. Health: `GET /health`.

### 3. Vercel (Next.js)

Env:

- `CONNECTOR_GATEWAY_URL` — e.g.
  `https://clauxen-connector-gateway.<account>.workers.dev`
- `CONNECTOR_GATEWAY_INTERNAL_TOKEN` — same value as the Worker secret
- `NEXT_PUBLIC_APP_URL` — public origin (drives CIMD documents + OAuth
  `returnUrl` values; must be HTTPS in production)

No Pipedream keys, no third-party connector SDKs. The only outbound calls are
direct HTTPS POSTs to each plugin's own `mcpUrl` (from the Worker in full
mode, from Next.js in local mode).

## Troubleshooting (Add button errors)

| Error code | Meaning | Fix |
|---|---|---|
| `connector_gateway_required` (503) | OAuth plugin, gateway env missing | Set `CONNECTOR_GATEWAY_URL` + matching `CONNECTOR_GATEWAY_INTERNAL_TOKEN`, or pick an open/API-key plugin |
| `connector_service_unavailable` (503) | Gateway env set but Worker down/unreachable | `wrangler deploy` the worker; check `GET /health` |
| `plugin_api_key_required` (409) | Server 401s without OAuth metadata | UI opens the key dialog; paste a key |
| `plugin_api_key_invalid` (401) | Key rejected by the server | Check the key with the provider, retry |
| `mcp_unreachable` (502) | No MCP handshake (DNS/TLS/dead URL) | Retry later; report the plugin |
| `mcp_oauth_undiscoverable` (409) | OAuth endpoints not advertised | Provider-side gap; use another plugin |
| `reauthorization_required` (409) | Token expired without refresh | Remove + re-add the plugin |

## Why not Pipedream (or similar)

| Concern | Third-party broker | Clauxen (this repo) |
|---|---|---|
| Token custody | Broker vault, shared tenancy | Our Worker seals tokens with our key before Postgres |
| OAuth client | Broker's client_id, broker callback | Our CIMD/DCR client, our callback per connector |
| Tool execution | Broker proxy + markup | Worker → MCP server direct Streamable HTTP |
| Approvals/audit | Broker dashboard | `connector_action_approvals` + `connector_audit_events` in our Postgres |
| Catalog | Broker's app list | Our 1,977 verified MCP URLs + 134 bundled icons |
| Cost/limits | Per-task pricing, rate caps | Cloudflare + Supabase we already run |

## Files

- UI: `src/app/(main)/plugins/**`, `src/client/components/plugins/**`
- Catalog: `src/server/plugins/catalog.ts`, `src/app/api/plugins/**`
- Install/saved: `src/app/api/v1/plugins/**`, `src/server/connectors/gateway.ts`,
  `src/server/connectors/local.ts`, `src/server/plugins/install-local.ts`
- API keys: `src/server/plugins/api-key-crypto.ts`, `private.plugin_mcp_api_keys`
- Gateway: `workers/connector-gateway/src/**` (`mcp-client`, `mcp-install`,
  `oauth`, `connectors`)
- Agent: `src/server/mcp/**`, `src/server/agent-core/runtime/query-loop.ts`
- CIMD: `src/app/api/oauth/client-metadata/[connectorKey]/route.ts`
- Icons: `public/assets/plugins/*.png` (134),
  `src/shared/lib/plugins/local-icons.ts`
- Diagnostics: `scripts/setup-plugins.mjs` (`npm run plugins:setup`)
