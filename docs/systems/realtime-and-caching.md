# Realtime and Caching

## 1. Caching layers (read path)

| Layer | Owner | What |
|---|---|---|
| Browser IndexedDB | Client | Per-user list + ≤40 bodies (`device-chat-cache`) |
| Cache API | chat-history Worker | Hottest pages / JWT memo / list |
| KV | chat-history Worker | Short TTL edge |
| R2 archives | chat-history Worker | Durable snapshots |
| Hyperdrive | CF → Postgres | Miss-only |
| Vercel Runtime Cache | Vercel | Settings / model catalog memo |
| Vercel Edge Config | Vercel | Flags |
| CDN static | Vercel + CF Cache Rules | `/_next/static`, `/assets` |
| HTML shells | — | **Not** zone-cached |

Write/stream path stays on Vercel functions + `after()` + pgmq — not CF as inference origin.

---

## 2. Invalidation / warm

After generate/delete/rename:

- `POST` Worker `/internal/invalidate`
- `POST` Worker `/internal/warm` (limits e.g. `[2,20]` + list refresh)
- Client device cache update

Helpers: `src/backend/chat/warm-history-cache.ts`.

---

## 3. Supabase Realtime

| Channel | Use | Caution |
|---|---|---|
| `postgres_changes` chats | Sidebar silent refresh | No full-list re-shimmer |
| `postgres_changes` chat_messages | Multi-tab hydrate | **Mute** while local SSE owns generation except id remaps |
| `postgres_changes` profiles | Profile sync | — |
| Broadcast | Presence / typing | Not WAL |

Empty WAL updates mid-stream historically cleared the orb — hence mute policy.

---

## 4. Generation coordination cache

Durable Object lease in chat-coord is not a content cache — it is concurrency control.

---

## 5. Static asset headers

From `vercel.json`:

- `/_next/static` — 1y immutable
- `/assets` — 1d + SWR
- `/api` — no-store everywhere

CF Cache Rules should mirror: long cache static, bypass API.

---

## 6. Related

- [`../perf-architecture.md`](../perf-architecture.md)
- [`cloudflare-workers.md`](./cloudflare-workers.md)
- [`chat-system.md`](./chat-system.md)
- [`../perf-metrics.md`](../perf-metrics.md)
