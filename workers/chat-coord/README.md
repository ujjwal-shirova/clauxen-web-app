# clauxen-chat-coord

Durable Object Worker that owns **per-chat generation leases**.

## Endpoints (internal token required)

| Path | Body | Result |
|------|------|--------|
| `POST /lease` | `{ chatId, leaseId }` | 200 ok / 409 conflict |
| `POST /release` | `{ chatId, leaseId }` | release lease |
| `POST /stop` | `{ chatId }` | set `stopRequested` for the active lease |
| `POST /status` | `{ chatId }` | `{ active, stopRequested, leaseId }` |
| `GET /health` | — | public health |

Header: `x-clauxen-internal: $CHAT_COORD_INTERNAL_TOKEN`

## Deploy

```bash
printf '%s' "$CHAT_COORD_INTERNAL_TOKEN" | npx wrangler secret put CHAT_COORD_INTERNAL_TOKEN
npx wrangler deploy
./scripts/wire-chat-coord-vercel.sh
```
