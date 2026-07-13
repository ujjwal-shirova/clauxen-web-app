# Clauxen R2 gateway Worker

Auth-gated upload/download for chat attachments and library files.

## Buckets (created 2026-07-13)

- `clauxen-images`
- `clauxen-documents`
- `clauxen-artifacts`
- `clauxen-skills` (optional skills packages)

## Deploy

```bash
cd workers/r2-gateway
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

Then set Vercel env:

```bash
WORKER_URL=https://clauxen-r2-gateway.<subdomain>.workers.dev
```

## Routes

- `PUT /upload/put?bucket=&key=` — authenticated body upload to R2
- `GET /download/:key?bucket=` — download (Cache API on immutable keys)
- `GET /health`
