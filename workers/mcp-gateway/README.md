# Clauxen MCP Gateway

Cloudflare Worker that backs the Plugins pages: it serves the scraped
plugin/MCP dataset from R2 and proxies live MCP tool discovery that browsers
can't perform directly (most MCP servers block CORS and require OAuth).

## Routes

| Route | Description |
|---|---|
| `GET /v0/plugins` | Full `mcp-plugins.json` dataset (from R2) |
| `GET /v0/plugins/search?q=&category=` | Server-side search + category filter |
| `GET /v0/mcp/tools?url=<mcp-server-url>` | Live `initialize` → `tools/list` introspection |
| `GET /v0/health` | Liveness check |

## One-time setup

```bash
npx wrangler login
npx wrangler r2 bucket create clauxen-plugin-data
```

## Upload the dataset

The dataset lives at `public/data/mcp-plugins.json` in the app repo
(regenerate anytime with `scripts/cursor-marketplace/fetch_marketplace.py`):

```bash
npm run upload-data
```

## Deploy

```bash
npm install
npm run deploy
```

After deploying, set the worker URL as `NEXT_PUBLIC_MCP_GATEWAY_URL` if you
want the web app to prefer the gateway over its built-in
`/api/plugins/mcp-tools` proxy.
