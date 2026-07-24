# Cloudflare Workers

Clauxen runs four Workers. Together they own edge read caching, blob I/O, generation leases, and auth email — **not** inference origin and **not** HTML caching of app shells.

Deploy helper: `./scripts/deploy-cloudflare-workers.sh` (needs valid `CLOUDFLARE_API_TOKEN`).  
Perf stack: `./scripts/ops/apply-cloudflare-perf-stack.sh`.

---

## 1. Ownership summary

| Worker | Binding focus | Consumed by |
|---|---|---|
| `clauxen-chat-history` | Cache API, KV, R2 archives, Hyperdrive | Browser + Vercel warm/invalidate |
| `clauxen-r2-gateway` | R2 buckets | Browser uploads/downloads (Bearer JWT) |
| `clauxen-chat-coord` | Durable Object leases | Vercel generate/stop |
| `clauxen-auth-email` | Email Sending + KV OTP | Vercel auth routes |

---

## 2. chat-history

Path: `workers/chat-history/`

### Purpose

Make Hyperdrive a **miss-only** path for chat list + message pages.

### Cache ladder

1. **Cache API** (same-colo) — hottest pages, JWT memo, chat list
2. **Workers KV** (`CHAT_HISTORY_CACHE`) — short TTL
3. **R2** (`clauxen-chat-archives`) — durable head snapshots
4. **Hyperdrive → Postgres** — cold miss

Response header: `x-clauxen-cache: cache-api|kv|r2|hyperdrive|list-*|jwt-*`

### Default TTLs (see Worker README; may be tuned)

| Key | TTL |
|---|---|
| Latest message page | ~1800s (ops may use 900s profile) |
| Cursor pages | ~300s |
| Chat list | ~120s |
| JWT memo | ~60s |

SWR style warm on invalidate. Hyperdrive tune example: `--max-age 300 --swr 60`. Product decision: Hyperdrive **caching disabled** for freshness in some deploys — follow current wrangler + MEMORY.

### API

| Method | Path | Auth |
|---|---|---|
| GET | `/v1/chats?limit=&projectId=` | Bearer Supabase JWT |
| GET | `/v1/chats/:id/messages?limit=&cursor_*` | Bearer JWT |
| POST | `/internal/warm` | `x-clauxen-internal` |
| POST | `/internal/invalidate` | `x-clauxen-internal` |
| GET | `/health` | public |

### App env

```
NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL=…
CHAT_HISTORY_WORKER_URL=…
CHAT_HISTORY_INTERNAL_TOKEN=…
```

Wire script: `scripts/wire-chat-history-vercel.sh`.

### Placement

Prefer `aws:us-west-1` near Supabase.

---

## 3. r2-gateway

Path: `workers/r2-gateway/`  
Env: `WORKER_URL`

### Purpose

Auth-gated upload/download to R2, bypassing Vercel 4.5MB body limits. Cache API on reads where safe.

### Buckets (bindings)

| Binding | Bucket |
|---|---|
| IMAGES | `clauxen-images` |
| DOCUMENTS | `clauxen-documents` |
| ARTIFACTS | `clauxen-artifacts` |
| USER_FILES | `clauxen-documents` (alias) |
| (+ skills / archives as configured) | `clauxen-skills`, `clauxen-chat-archives` |

### Auth

Worker PUTs require `Authorization: Bearer <supabase access token>` when `worker: true` on presign.

Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

### App flow

1. `POST /api/v1/files/presign` → metadata + Worker URL
2. Client PUT to Worker
3. `POST /api/v1/files/complete`

Production uploads **require** `WORKER_URL`.

---

## 4. chat-coord

Path: `workers/chat-coord/`  
Env: `CHAT_COORD_WORKER_URL`, `CHAT_COORD_INTERNAL_TOKEN`

### Purpose

Per-`chatId` **generation lease** via Durable Object so concurrent Vercel isolates cannot double-generate.

### API

| Path | Body | Result |
|---|---|---|
| POST `/lease` | `{ chatId, leaseId }` | 200 or 409 |
| POST `/release` | `{ chatId, leaseId }` | release |
| POST `/stop` | `{ chatId }` | set stopRequested |
| POST `/status` | `{ chatId }` | status JSON |
| GET `/health` | — | health |

Header: `x-clauxen-internal: $CHAT_COORD_INTERNAL_TOKEN`

Client: `src/server/chat/chat-coord-client.ts` + `generation-registry.ts`.

Wire: `scripts/wire-chat-coord-vercel.sh`.

---

## 5. auth-email

Path: `workers/auth-email/`  
Env: `AUTH_EMAIL_WORKER_URL`, `AUTH_EMAIL_INTERNAL_TOKEN`

### Purpose

Send OTP + magic link emails via Cloudflare Email Sending; store hashed secrets in KV.

### API

| Path | Purpose |
|---|---|
| POST `/v1/otp/send` | Email 6-digit OTP |
| POST `/v1/otp/verify` | → signupTicket |
| POST `/v1/otp/consume-ticket` | Burn ticket |
| POST `/v1/magic/*` | Magic link send/inspect/consume |
| GET `/health` | Health |

FROM: `no-reply@clauxen.com`  
Domain onboard: Email Service → Email Sending for `clauxen.com` (SPF/DKIM).

**KV TTL ≥ 60s.**

Wire: `scripts/wire-auth-email-vercel.sh`.

---

## 6. Zone settings (not Workers, but paired)

Product decisions (Free plan):

- HTTP/3 on, Early Hints on, Tiered Cache (Smart)
- Rocket Loader **off**
- Cache Rules: `/_next/static` 1y; `/assets` 1d; **Bypass `/api`**
- Custom WAF rules (5 max): Managed Challenge on app HTML entry; Block scanners/empty-UA/sensitive paths; Challenge suspicious auth POSTs
- SSL Full (strict); AI Labyrinth on; Block AI Training crawlers; Browser Integrity Check on
- Under Attack mode left OFF (targeted custom challenge instead)
- Do **not** use deprecated `cf.threat_score` in custom rules
- Skip Argo unless user asks (paid)
- Account API token may deploy Workers/Hyperdrive but not Zone Cache Rules (403) — need zone-edit token or dashboard

CF Managed Challenge POST→GET handled in `src/proxy.ts`.

See [`../ops/cloudflare-zone-hardening.md`](../ops/cloudflare-zone-hardening.md).

---

## 7. Deploy checklist

1. Valid `CLOUDFLARE_API_TOKEN` (Account + Workers Scripts Edit; zone edit if changing Cache Rules)
2. `npx wrangler secret put …` for each Worker secret
3. `./scripts/deploy-cloudflare-workers.sh` or per-Worker `wrangler deploy`
4. Wire Vercel env URLs + tokens (prod/preview sensitive + development encrypted)
5. Smoke: `./scripts/ops/smoke-perf-stack.sh` if present
6. Confirm `x-clauxen-cache` headers on hydrate

---

## 8. Related

- [`../perf-architecture.md`](../perf-architecture.md)
- [`storage-and-files.md`](./storage-and-files.md)
- [`authentication.md`](./authentication.md)
- [`chat-system.md`](./chat-system.md)
