# Clauxen Triple-Stack Speed Architecture

Source of truth for where each platform owns performance work. Do not duplicate jobs across Vercel, Cloudflare, and Supabase.

## Ownership

| Concern | Owner | Not used for this |
|--------|--------|-------------------|
| App HTML / React / soft-nav | Vercel | CF HTML caching (bypass shells) |
| Static `/_next/static`, `/assets` | Vercel CDN + CF Tiered Cache Rules | Worker Cache API |
| Chat hydrate / list | CF `clauxen-chat-history` + **browser IndexedDB device cache** | Vercel Runtime Cache, Supabase Edge Functions |
| Chat write / stream / finalize | Vercel Streaming Function + `after()` | CF Workers as inference origin |
| Generation lease / stop | CF Durable Object (`clauxen-chat-coord`) | Isolate-local registry alone |
| Attachments / artifacts | CF R2 + `clauxen-r2-gateway` | Vercel Blob, Supabase Storage binaries |
| Feature flags / model kill-switch | Vercel Edge Config | KV (except Worker OTP) |
| Settings / model catalog memo | Vercel Runtime Cache | CF KV |
| Durable rows / RPCs | Supabase Postgres | D1 / DO SQL as system of record |
| Live row sync | Supabase Realtime `postgres_changes` | Polling |
| Typing / presence | Supabase Realtime Broadcast | `postgres_changes` |
| Project / chat RAG | Supabase pgvector | Cloudflare Vectorize |
| Background jobs | `pgmq` / `pg_cron` (+ CF Queues for Worker-only) | Blocking generate TTFT |
| Auth email OTP | CF `clauxen-auth-email` | Supabase Edge Functions |
| Zone transport | CF HTTP/3, Early Hints, Tiered Cache (Smart) | Vercel; Argo optional/skipped |

## Hot paths

1. **New chat send:** optimistic UI → createChat → DO lease → `beginChatTurn` → SSE → async invalidate/warm → `after()` enqueue title/embed.
2. **Open `/c/[id]`:** device IndexedDB (if warm) → SSR seed ≤120ms → silent Worker reconcile; never zone-cached HTML.
3. **Sidebar:** device meta → Worker list cache + Realtime chats + DO generating hint.
4. **Files:** browser → r2-gateway → R2; Postgres metadata only.

Device cache (`src/frontend/lib/device-chat-cache.ts`): per-user IndexedDB mirror of recent list + up to 40 chat bodies. No polling — Realtime + silent SWR refresh. Server remains source of truth.

## Env checklist

- Vercel: `WORKER_URL`, `CHAT_COORD_WORKER_URL`, `CHAT_COORD_INTERNAL_TOKEN`, `CHAT_HISTORY_*`, `EDGE_CONFIG`, region `pdx1` (near Supabase us-west-1)
- Production uploads require `WORKER_URL` (no direct S3 / Blob fallback)
- Hyperdrive chat-history: **caching disabled**
- Supabase: transaction pooler `:6543` (Dedicated Pooler only if already on plan — do not buy addons unprompted)

## Related

- [`src/backend/config/cloudflare-perf-profile.ts`](../src/backend/config/cloudflare-perf-profile.ts)
- [`scripts/ops/apply-cloudflare-perf-stack.sh`](../scripts/ops/apply-cloudflare-perf-stack.sh)
- [`workers/chat-coord/`](../workers/chat-coord/)
