# Self-hosted plugins & MCP platform

Clauxen runs its **own** Model Context Protocol and REST connector platform.
No Nango, no Pipedream, no third-party connector cloud, no per-call broker
in the middle. The Next.js app owns the catalog and chat runtime; Postgres
(Supabase) owns installs, tools, approvals, and the encrypted vault; a
Cloudflare Worker handles OAuth under the Clauxen name.

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

- `scripts/connectors/mcp-catalog/plugins.json` — 1,977 plugins with live-verified
  `mcpUrl` values. Source of truth for `/plugins`.
- `src/modules/connectors/server/plugins/catalog.ts` — filters to verified MCP only, resolves
  bundled icons first (`src/modules/connectors/catalog/local-icons.ts` → 134 files in
  `public/assets/plugins/`), then remote artwork, then letter avatars.
- `src/app/api/plugins/route.ts` — public paginated search (`?q=&category=
  &page=`), cached at the edge. `src/app/api/plugins/by-ids/route.ts` serves
  Saved-tab lookups.

### Install & OAuth (own gateway)

`POST /api/v1/plugins/install` uses the worker when `CONNECTOR_GATEWAY_*` is
set, else `src/modules/connectors/server/plugins/install-local.ts` (same key derivation, same
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
  (`src/modules/connectors/server/plugins/api-key-crypto.ts`, AES-256-GCM, per-install AAD).
  Zero-config default derives the key from `SUPABASE_SERVICE_ROLE_KEY`;
  set `PLUGIN_CREDENTIAL_KEY` for breach separation. Re-installing with a
  new key rotates it; Remove wipes it.

### Chat runtime (agent tools)

- `src/modules/connectors/server/mcp/registry.ts` (`McpConnectorHarness`) discovers the user's
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

### 4. REST apps (Clauxen OAuth, provider APIs)

Nothing is routed through Nango, Pipedream, or any other connector cloud.
`npm run connectors:seed` upserts GitHub, Slack, Notion, Gmail, Google Drive,
and Figma into `connector_catalog` / `connector_tools` with each provider's
own HTTPS API. Users connect them on `/connect`. OAuth screens show
**Clauxen**. Client IDs/secrets stay on Cloudflare:

```sh
npm run connectors:configure-oauth -- github
```

That calls `PUT /v1/admin/connectors/:key/oauth`. The worker AES-GCM-seals
`client_secret` into `private.connector_oauth_configs`. User tokens land in
`private.connector_credentials`. The agent sees connected tools as
`mcp__github__list_repos` (and the rest) through `/v1/tools/list` +
`/v1/tools/call`.

Until an OAuth app is registered with the provider, Connect returns
`connector_not_configured`. MCP plugins on `/plugins` do not need those apps.

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
| `connector_not_configured` (409) | REST OAuth app missing | `npm run connectors:configure-oauth -- <key>` with provider client id/secret |

## Why not Pipedream (or similar)

| Concern | Third-party broker | Clauxen (this repo) |
|---|---|---|
| Token custody | Broker vault, shared tenancy | Our Worker seals tokens with our key before Postgres |
| OAuth client | Broker's client_id, broker callback | Clauxen CIMD/DCR client, Clauxen callback per connector |
| Tool execution | Broker proxy + markup | Worker → GitHub/Slack/MCP server direct HTTPS |
| Approvals/audit | Broker dashboard | `connector_action_approvals` + `connector_audit_events` in our Postgres |
| Catalog | Broker's app list | Our 1,977 verified MCP URLs + Clauxen REST recipes |
| Branding | Broker name on OAuth screens | `client_name: Clauxen`, callback on our Worker |

## Files

- UI: `src/app/(main)/plugins/**`, `src/modules/connectors/ui/plugins/**`
- Catalog: `src/modules/connectors/server/plugins/catalog.ts`, `src/app/api/plugins/**`
- Install/saved: `src/app/api/v1/plugins/**`, `src/modules/connectors/server/gateway.ts`,
  `src/modules/connectors/server/local.ts`, `src/modules/connectors/server/plugins/install-local.ts`
- API keys: `src/modules/connectors/server/plugins/api-key-crypto.ts`, `private.plugin_mcp_api_keys`
- Gateway: `workers/connector-gateway/src/**` (`mcp-client`, `mcp-install`,
  `oauth`, `connectors`)
- Agent: `src/modules/connectors/server/mcp/**`, `src/server/agent-core/runtime/query-loop.ts`
- CIMD: `src/app/api/oauth/client-metadata/[connectorKey]/route.ts`
- Icons: `public/assets/plugins/*.png` (134),
  `src/modules/connectors/catalog/local-icons.ts`
- REST recipes: `src/modules/connectors/server/rest-providers.ts`,
  `scripts/connectors/recipes/` (offline catalog of provider endpoints, not a runtime)
- Catalog/health APIs: `src/app/api/v1/connectors/catalog/route.ts`,
  `src/app/api/v1/connectors/health/route.ts`
- Seed/configure: `npm run connectors:seed`, `npm run connectors:configure-oauth`
- Diagnostics: `scripts/connectors/setup.mjs` (`npm run plugins:setup`)
