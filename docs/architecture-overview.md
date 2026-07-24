# Architecture Overview

## 1. What Clauxen is

Clauxen is an AI chat product with ChatGPT/Claude-class UX:

- Streaming multi-turn chat with tool-use (web search, fetch, code sandbox, skills)
- Project-scoped RAG over uploaded documents
- Personalization (style, custom instructions, capabilities)
- Billing / plans / gifts via Razorpay
- Workspaces with SSO/SCIM for enterprise
- Shareable chat URLs (`/c/{longTextId}`)
- Device-local IndexedDB cache for signed-in users (list + recent bodies)
- Edge Workers for history hydrate, R2 gateway, generation leases, and auth email

It is **not** a thin chat wrapper. The product spans three cloud platforms with explicit ownership boundaries so caches and storage are not duplicated.

---

## 2. Triple-stack diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Browser (React 19)                               │
│  ChatView · Sidebar · Composer · Overlays (#settings/#pricing)           │
│  IndexedDB device-chat-cache · Soft-nav (useInstantNavigate)             │
└───────────────┬─────────────────────────────┬────────────────────────────┘
                │ HTML / RSC / SSE            │ Worker fetch (JWT)
                ▼                             ▼
┌───────────────────────────┐   ┌──────────────────────────────────────────┐
│  Vercel (Next.js)         │   │  Cloudflare                              │
│  - App Router pages       │   │  - Zone: HTTP/3, Early Hints, WAF        │
│  - /api/v1/* handlers     │   │  - chat-history Worker (Cache→KV→R2→HD)  │
│  - Streaming generate     │   │  - r2-gateway Worker (PUT/GET blobs)     │
│  - Edge Config flags      │   │  - chat-coord Durable Object (lease)     │
│  - Runtime Cache (memo)   │   │  - auth-email Worker (OTP + magic)       │
│  - after() background     │   │  - R2 buckets (images/docs/artifacts…)   │
└─────────────┬─────────────┘   └───────────────────┬──────────────────────┘
              │ service role / pooler               │ Hyperdrive (miss-only)
              ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Supabase                                             │
│  GoTrue (auth.clauxen.com) · Postgres · Realtime · pgvector · pgmq       │
│  System of record for rows; never R2 binaries; never Vectorize           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Ownership rule:** each concern has one owner. See [`perf-architecture.md`](./perf-architecture.md).

---

## 3. Repository layout

| Path | Role |
|---|---|
| `src/app/` | Next.js routes: pages under `(main)`, auth, checkout, share; all `/api` handlers |
| `src/components/` | React UI (`components/agent/` = chat transcript) |
| `src/hooks/`, `src/contexts/`, `src/stores/` | Client hooks and providers |
| `src/lib/`, `src/styles/` | Shared helpers and CSS fragments |
| `src/marketing/` | Marketing site components and content |
| `src/server/` | Server services, repositories, inference, auth, billing, storage, db pool |
| `src/server/agent-core/` | Chat agent loop (Provider Messages + tools) |
| `src/projects/` | Project RAG ingestion/queue helpers |
| `src/prompts/` | Persona markdown (`virgil.md`) + modular personalization instructions |
| `src/utils/supabase/` | Browser/server/middleware Supabase clients |
| `src/proxy.ts` | Edge proxy: CF challenge POST→GET, skip `/api` session refresh |
| `workers/` | Four Workers: auth-email, chat-history, r2-gateway, chat-coord |
| `supabase/migrations/` | Ordered SQL schema + RPCs + RLS |
| `scripts/` | Deploy, env reconcile, workers, ingestion worker, ops |
| `brain/MEMORY.md` | Agent durable memory (decisions/gotchas) |
| `docs/` | This documentation library |

---

## 4. Runtime layers (request path)

### 4.1 Document navigation

1. User hits `/` → after identity, soft-replaces to `/new` (hash preserved).
2. `(main)/layout.tsx` mounts shell: sidebar, providers, overlay host.
3. `/new` and `/c/[chatId]` both render `ChatView` (no `loading.tsx` — avoids shimmer races).
4. Soft navigation via `useInstantNavigate` (pushState + Next soft sync) keeps optimistic UI alive.

### 4.2 Chat send (happy path)

1. Composer builds optimistic user + assistant rows with stable `clientId`s.
2. `createChat` (if new) → navigate to `/c/{id}` the instant durable id exists (`onChatCreated`).
3. Persist user turn → `beginChatGeneration` (Durable Object lease via chat-coord).
4. `POST /api/v1/chats/:id/generate` returns SSE (`CLAUXEN_STREAM_HEADERS`).
5. Client `use-chat-api` consumes SSE; agent frames / thinking / tools / answer tokens update UI.
6. On complete: finalize messages, transcript lines, invalidate/warm chat-history Worker, enqueue title/embed via `after()` / pgmq.
7. Realtime muted for messages while this tab owns SSE (except id remaps).

### 4.3 Open existing chat

1. Device IndexedDB body if warm (`device-chat-cache`).
2. SSR seed race ≤120ms (`load-chat-route-seed`) — prefer seed over shimmer when hit.
3. Silent Worker reconcile (`listAllChatMessages`, limit 500).
4. Never let sparse SSR seed wipe live/optimistic turns (`handleSelectChat`).

### 4.4 File upload

1. `POST /api/v1/files/presign` → `user_files` row + Worker URL.
2. Browser `PUT` to r2-gateway with `Authorization: Bearer <supabase access token>`.
3. `POST /api/v1/files/complete` finalizes.
4. Chat attach via `chat_message_parts.file_id` + metadata for UI reload.

---

## 5. Domain modules (backend)

| Module | Path | Responsibility |
|---|---|---|
| Auth | `src/server/auth/` | Session resolution: API key → Supabase JWT → dev cookie |
| Chat service | `src/server/services/chat.service.ts` | Create/list/generate/title/pin/share/transcript orchestration |
| Inference | `src/server/inference/` | Provider clients, SSE, tools, system prompts, agent stream |
| Repositories | `src/server/repositories/` | Thin SQL/RPC access per aggregate |
| Billing | `src/server/billing/` + `services/billing.service.ts` | Razorpay orders, verify, subscriptions |
| Storage | `src/server/storage/` | R2 signing / Worker URL construction |
| Cache | `src/server/cache/` | History warm/invalidate helpers |
| Config | `src/server/config/` | Edge flags, Cloudflare perf profile |
| DB | `src/server/db/` | `pg` pool, errors |
| Training | `src/server/training/` | Transcript JSONL format for model training exports |
| HTTP | `src/server/http/` | Route wrappers, params, response helpers |

---

## 6. Frontend modules

| Module | Path | Responsibility |
|---|---|---|
| Chat API hook | `hooks/use-chat-api.ts` | Signed-in chat: list, hydrate, send, stream, edit/branch, pin |
| Local chat hook | `hooks/use-chat.ts` | Guest/local IndexedDB path (kept out of ChatSessionProvider main bundle) |
| Chat session | `contexts/chat-session-context.tsx` | Provider wired to `useChatApi` only |
| Auth | `contexts/auth-context.tsx` + `hooks/use-auth.ts` | Session boot, quiet vs full sync |
| Preferences | `contexts/app-preferences-context.tsx` | Theme/font/motion/follow-ups → DOM + PATCH settings |
| Overlays | `hooks/use-app-overlays.tsx` + `components/app-overlay-host.tsx` | Hash overlays via `history.pushState` |
| Device cache | `lib/device-chat-cache.ts` | Per-user IndexedDB list + ≤40 bodies |
| Dedupe/hydrate | `lib/dedupe-chat-messages.ts`, `lib/hydrate-chat-messages.ts` | Merge optimistic + server + realtime safely |
| Agent frames | `lib/agent-frames.ts`, `lib/agent-stream-reducer.ts` | Timeline / orb / Worked-for labels |
| Follow-ups | `lib/follow-up-tags.ts` | Extract `<prompt>` tags into buttons |

---

## 7. Identity & tenancy model

- **User** — `auth.users` + mirrored `public.profiles`
- **Workspace** — team container (`workspaces`, members, roles, domains, SSO, SCIM)
- **Project** — folder with instructions + files + RAG chunks
- **Chat** — owned by user (optional `project_id`); id is **text** long-form
- **Message** — rows in `chat_messages` with parts, branches, reactions
- **File** — metadata in `user_files`; bytes in R2
- **Subscription** — `subscriptions` + `plans` catalog; Razorpay as payment rail

---

## 8. Streaming protocol (high level)

Generate returns Server-Sent Events. The client parser in `use-chat-api` / stream helpers:

- Must **propagate terminal errors** into visible assistant failure text (never swallow into blank completed messages).
- Live streaming assistant **wins** over empty cold server/IDB snapshots in dedupe scoring.
- Agent activity frame: live `Label · duration`; thinking-only collapses to `Thought for Ns`; tools keep `Worked for …`.
- Timing persisted on `content_json.agent_ui` for reload.

Detailed event vocabulary: [`systems/inference-and-models.md`](./systems/inference-and-models.md) and [`systems/chat-system.md`](./systems/chat-system.md).

---

## 9. Configuration surfaces

| Surface | Mechanism |
|---|---|
| Feature flags / maintenance / model kill-switch | Vercel Edge Config (`EDGE_CONFIG`, `readEdgeFlags`) |
| User settings JSONB | `user_settings.settings` via `/api/v1/settings` |
| Plan entitlements | `plans` + `subscriptions` |
| Inference model | `Provider_Model_Clauxen_V1` (server) |
| Zone security | Cloudflare custom rules (Free plan: 5 custom + 1 rate limit) |
| Env reconcile | `scripts/reconcile-vercel-env.mjs` — sensitive prod/preview, encrypted development |

---

## 10. Non-goals / explicit exclusions

These are **intentionally not** on the product path:

- Cloudflare Vectorize (use Supabase pgvector)
- Vercel Blob (use R2)
- D1 as system of record (use Postgres)
- Argo Smart Routing unless explicitly requested (paid)
- Polling for chat list/messages (Realtime + silent SWR)
- Separate signup page (unified login; `/signup` → `/login`)
- Path-based settings as primary UX (hash overlays; legacy paths redirect)

See [`backend-audit.md`](./backend-audit.md) for historical rationale.

---

## 11. Related documents

- [`systems/chat-system.md`](./systems/chat-system.md)
- [`systems/frontend-architecture.md`](./systems/frontend-architecture.md)
- [`reference/api-reference.md`](./reference/api-reference.md)
- [`reference/database-schema.md`](./reference/database-schema.md)
- [`perf-architecture.md`](./perf-architecture.md)
