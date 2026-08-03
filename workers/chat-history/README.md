# Clauxen chat-history Worker

Edge data plane with source-consistent live reads:

1. **Hyperdrive** → Supabase Postgres — authoritative default for mutable chat lists and messages (`fresh=1`)
2. **Cache API** + **Workers KV** — optional paint hints only when callers explicitly request `fresh=0`
3. **R2** (`CHAT_ARCHIVES` → `clauxen-chat-archives`) — background archives, not live history authority
4. **Cache API** — short-lived JWT verification memo

## Live

- Worker: `https://clauxen-chat-history.ujjwal-8fc.workers.dev`
- Hyperdrive id: `54df64d31cce4e6f8f34415c6fb4e849`
- KV: `CHAT_HISTORY_CACHE` (`8d917e9639df4dc2a12be2a35cf264af`)
- R2: `clauxen-chat-archives`
- Placement: `aws:us-west-1`

## API

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/v1/chats?limit=50&projectId=&fresh=1` | Bearer JWT | Source-consistent sidebar list |
| GET | `/v1/chats/:id/messages?limit=&cursor_*&fresh=1` | Bearer JWT | Source-consistent message pages |
| POST | `/internal/warm` | `x-clauxen-internal` | Warm limits `[2,20]` + refresh list |
| POST | `/internal/invalidate` | `x-clauxen-internal` | Purge message + list caches |
| GET | `/health` | — | Binding status |

Responses include `x-clauxen-cache: cache-api|kv|r2|hyperdrive|list-*|jwt-*`.

Default cache-hint TTLs: latest **60s**, cursor **300s**, list **60s**, JWT memo **60s**. Normal app reads use `private, no-store` and bypass history snapshots.

## App env

```bash
NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CHAT_HISTORY_INTERNAL_TOKEN=<shared-secret>
```

## Deploy / Hyperdrive tune

```bash
# Needs a valid CLOUDFLARE_API_TOKEN
./scripts/ops/apply-cloudflare-perf-stack.sh

# Or manually:
cd workers/chat-history && npx wrangler deploy
npx wrangler hyperdrive update 54df64d31cce4e6f8f34415c6fb4e849 --max-age 300 --swr 60
```

Optional second Hyperdrive (`--caching-disabled`) → bind as `HYPERDRIVE_FRESH` for read-after-write.

Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CHAT_HISTORY_INTERNAL_TOKEN` (+ `DATABASE_URL` fallback).
