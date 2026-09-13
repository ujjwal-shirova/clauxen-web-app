# Self-hosted plugins & MCP platform

Clauxen runs its **own** Model Context Protocol platform. No Pipedream, no
third-party connector cloud, no per-call broker in the middle. The Next.js app
owns the catalog and chat runtime; a Cloudflare Worker owns OAuth, the token
vault, and MCP tool execution; Postgres (Supabase) owns installs, tools,
approvals, and audit.

## Architecture

```
Browser  →  Next.js (Vercel)  →  connector-gateway (Cloudflare Worker)  →  MCP server
  /plugins      /api/plugins        /v1/mcp/install (probe + OAuth + sync)
  Add button    /api/v1/plugins/*   /v1/tools/list + /v1/tools/call
  @mention      agent query-loop    /v1/oauth/* (DCR + CIMD + PKCE)
                    ↓                        ↓
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

`POST /api/v1/plugins/install` → `src/server/connectors/gateway.ts` →
`POST {gateway}/v1/mcp/install` (`workers/connector-gateway/src/mcp-install.ts`):

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

### Chat runtime (agent tools)

- `src/server/mcp/registry.ts` (`McpConnectorHarness`) discovers the user's
  gateway tools per turn (8s budget, failures skipped) and exposes them as
  `mcp__<connectorKey>__<toolName>`.
- `src/server/agent-core/runtime/query-loop.ts` injects connected plugin names
  into the system prompt and routes `mcp__*` calls through the gateway, which
  enforces approvals (`write`/`destructive`/`sensitive` require confirmation),
  refreshes OAuth tokens with a Postgres lease, and audits every call.

### Saved collections (own backend)

- `public.plugin_collections (user_id, plugin_id)` — server-persisted Saved
  tab (`supabase/migrations/20260913000000_plugin_collections.sql`).
- `GET/POST/DELETE /api/v1/plugins/collection` — authenticated CRUD.
- `usePluginInstallations` merges server + `localStorage` so logged-out
  saves survive and logged-in saves sync across devices.

## Setup

### 1. Supabase (Postgres)

```sh
supabase db push
```

Required tables ride with the repo: `connector_catalog`, `connector_tools`,
`connector_installations`, `connector_action_approvals`, `connector_audit_events`,
`private.connector_oauth_configs`, `private.connector_credentials`,
`private.connector_oauth_transactions`, `plugin_collections`, plus the
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
the Worker's direct HTTPS POSTs to each plugin's own `mcpUrl`.

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
- Install/saved: `src/app/api/v1/plugins/**`, `src/server/connectors/gateway.ts`
- Gateway: `workers/connector-gateway/src/**` (`mcp-client`, `mcp-install`,
  `oauth`, `connectors`)
- Agent: `src/server/mcp/**`, `src/server/agent-core/runtime/query-loop.ts`
- CIMD: `src/app/api/oauth/client-metadata/[connectorKey]/route.ts`
- Icons: `public/assets/plugins/*.png` (134),
  `src/shared/lib/plugins/local-icons.ts`
