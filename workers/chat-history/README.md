# Clauxen chat-history Worker

Edge keyset pagination for `chat_messages`, backed by:

- **Hyperdrive** → Supabase Postgres (`fetch_chat_messages_page` RPC)
- **Workers KV** (`CHAT_HISTORY_CACHE`) for latest-page cache
- **Cache API** as a same-colo secondary cache
- Supabase JWT auth (`Authorization: Bearer <access_token>`)

## Live

- Worker: `https://clauxen-chat-history.ujjwal-8fc.workers.dev`
- Hyperdrive id: `54df64d31cce4e6f8f34415c6fb4e849`
- KV namespace: `CHAT_HISTORY_CACHE` (`8d917e9639df4dc2a12be2a35cf264af`)
- Account: `8fc7a67e9057989309921f362784ecf4`

## App env

```bash
NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.ujjwal-8fc.workers.dev
CLOUDFLARE_ACCOUNT_ID=8fc7a67e9057989309921f362784ecf4
```

These are set on Vercel (production/preview/development) and in `.env.production`.

## Redeploy

```bash
cd workers/chat-history
npx wrangler deploy
```

Secrets (already set): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`.

## API

`GET /v1/chats/:chatId/messages?limit=2&cursor_id=&cursor_created_at=`

Authorization: `Bearer <supabase_access_token>`

Default `limit` is **2** (one user + one assistant pair).
