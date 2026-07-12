# Clauxen chat-history Worker

Edge keyset pagination for `chat_messages`, backed by Cloudflare Hyperdrive → Supabase Postgres.

The Next.js app prefers this Worker when `NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL` is set (browser JWT). Otherwise it uses the same `fetch_chat_messages_page` RPC via the Node API.

## Setup

1. Create Hyperdrive against the Supabase **non-pooling** connection string:

```bash
export CLOUDFLARE_API_TOKEN=...   # Account API token with Workers + Hyperdrive
cd workers/chat-history
npx wrangler hyperdrive create clauxen-supabase-chat \
  --connection-string="$POSTGRES_URL_NON_POOLING"
```

2. Paste the Hyperdrive id into `wrangler.toml` (`[[hyperdrive]].id`).

3. Set secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
# Optional bootstrap without Hyperdrive:
# npx wrangler secret put DATABASE_URL
```

4. Deploy:

```bash
npm install
npx wrangler deploy
```

5. Point the app at the Worker:

```bash
# .env.local / Vercel
NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.<account>.workers.dev
CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.<account>.workers.dev
```

## API

`GET /v1/chats/:chatId/messages?limit=2&cursor_id=&cursor_created_at=`

Authorization: `Bearer <supabase_access_token>`

- Default `limit` is **2** (one user + one assistant pair).
- Latest pages (no cursor) are cached briefly in the Workers Cache API keyed by `userId+chatId`.
- Older pages are never cached.

## Local

```bash
npx wrangler dev --local
```

Uses `localConnectionString` in `wrangler.toml`, or set `DATABASE_URL` in `.dev.vars`.
