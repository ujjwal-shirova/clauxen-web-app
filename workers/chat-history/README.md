# Clauxen chat-history Worker

Edge keyset pagination for `chat_messages`, optimized so Hyperdrive is a **miss-only** path:

1. **Cache API** (same-colo, no daily quota) — hottest latest pages
2. **Workers KV** (`CHAT_HISTORY_CACHE`) — short TTL edge cache
3. **R2** (`CHAT_ARCHIVES` → `clauxen-chat-archives`) — durable head snapshots
4. **Hyperdrive** → Supabase Postgres (`fetch_chat_messages_page`) — cold miss only

After each completed turn the Next app can `POST /internal/warm` (shared secret) so the next reload is served from Cache/KV/R2 without burning Hyperdrive quota.

## Live

- Worker: `https://clauxen-chat-history.ujjwal-8fc.workers.dev`
- Hyperdrive id: `54df64d31cce4e6f8f34415c6fb4e849`
- KV namespace: `CHAT_HISTORY_CACHE` (`8d917e9639df4dc2a12be2a35cf264af`)
- R2 bucket: `clauxen-chat-archives`
- Account: `8fc7a67e9057989309921f362784ecf4`

## App env

```bash
NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CHAT_HISTORY_INTERNAL_TOKEN=<shared-secret-for-/internal/warm>
CLOUDFLARE_ACCOUNT_ID=8fc7a67e9057989309921f362784ecf4
```

Public Worker URLs are in Vercel + `.env.production`. Set `CHAT_HISTORY_INTERNAL_TOKEN` to the same value as the Worker secret.

## Redeploy

```bash
cd workers/chat-history
npx wrangler deploy
```

Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `CHAT_HISTORY_INTERNAL_TOKEN`.

## API

`GET /v1/chats/:chatId/messages?limit=2&cursor_id=&cursor_created_at=`

Authorization: `Bearer <supabase_access_token>`

Default `limit` is **2** (one user + one assistant pair). Latest pages are pair-aligned server-side.

`POST /internal/warm` — write-through Cache/KV/R2 after a turn completes.
Header: `x-clauxen-internal: <CHAT_HISTORY_INTERNAL_TOKEN>`

## Limits note

Free Workers still have a daily request cap; Cache API itself has no daily quota. Paid Workers ($5) removes the 100k/day cliff. Hyperdrive queries stay rare because of the cache ladder.
