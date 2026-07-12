# Clauxen chat-history Worker

Edge keyset pagination for `chat_messages`, backed by Cloudflare Hyperdrive → Supabase Postgres.

## Setup

1. Create Hyperdrive against the Supabase connection string:

```bash
npx wrangler hyperdrive create clauxen-supabase \
  --connection-string="$POSTGRES_URL_NON_POOLING"
```

2. Paste the Hyperdrive id into `wrangler.toml` (`[[hyperdrive]].id`).

3. Set secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

4. Deploy:

```bash
npm install
npx wrangler deploy
```

## API

`GET /v1/chats/:chatId/messages?limit=20&cursor_id=&cursor_created_at=`

Authorization: `Bearer <supabase_access_token>`

Latest pages (no cursor) are cached briefly in the Workers Cache API keyed by `userId+chatId`.
