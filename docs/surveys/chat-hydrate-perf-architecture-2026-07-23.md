# Chat Hydrate & Performance Architecture Proposal

**Date:** 2026-07-23  
**Question:** Must we store chat history locally on the user’s device? What do ChatGPT / Claude do? How should Cloudflare + Supabase make open/list/hydrate insanely fast?  
**Status:** Design proposal (not yet implemented). Builds on existing triple-stack ownership in `docs/perf-architecture.md`.

---

## 1. Direct answer

### Do we need to store full chat history in IndexedDB / local disk?

**No — not as product design, and not as system of record.**

| Role | Should live locally? | Why |
|------|----------------------|-----|
| Durable messages / titles / pins | **No** | Supabase Postgres is SoR (already true) |
| Full transcript archive on device | **No** | Privacy, disk, stale sync, multi-device drift |
| In-memory React state for the open chat | **Yes** | Required for streaming UI |
| Tiny “instant paint” hint (sidebar titles of last N chats) | **Optional** | Perceived speed only — never authority |
| Attachments / images / PDFs | **No** (use R2 URLs) | Bytes belong in object storage |

Storing “the entire chat history locally” is the wrong mental model for a ChatGPT/Claude-class app. It fights the server, causes reconcile bugs, and does not match how those products work.

### What ChatGPT and Claude actually do (practical model)

They do **not** treat the laptop as the history database.

Behind the scenes (public behavior + industry pattern):

1. **Server = truth** — conversations and messages live in their cloud DBs.  
2. **Open a chat** — client fetches that thread (often already edge-cached / CDN-accelerated API).  
3. **Sidebar list** — fetched from API; kept in **RAM** while the tab is open.  
4. **While streaming** — tokens live in memory; then persist server-side.  
5. **Multi-device** — works because history is not “your hard drive.”  
6. **Local caches** (if any) are **ephemeral paint / offline hints**, not the product store.

Claude.ai and ChatGPT feel instant because:

- The **network hop to a warm edge** is short,  
- Responses are **small and paginated**,  
- The UI paints from **RAM** after the first fetch,  
- They do **not** wait to load “all history on disk” first.

Clauxen already has the right ingredients (Supabase + chat-history Worker + Hyperdrive). The mistake is over-investing in **device IndexedDB as a second history DB**.

---

## 2. What Clauxen does today (honest map)

```
RAM (Zustand)
  → IndexedDB device cache (list + ≤40 full bodies)   ← paint first
  → chat-history Worker (Bearer JWT)
        Cache API → KV → Hyperdrive → Supabase Postgres
  → fallback: Vercel /api/v1 → Node pool → Postgres
```

| Layer | Status today | Verdict |
|-------|--------------|---------|
| Supabase Postgres | SoR for chats/messages | Keep |
| Hyperdrive (caching disabled) | Worker miss path | Keep (correct for read-after-write) |
| Worker Cache API + KV | Hot list / message pages | Keep & strengthen |
| R2 `CHAT_ARCHIVES` | Bound but **unused** on read path | Activate for cold/old pages only |
| Browser IndexedDB | List + up to 40 full bodies | **Shrink / demote** — not full history |
| Guest `/api/chat` + local IDB | Parallel offline stack | Out of scope here (Phase B debt) |

Docs sometimes say “Cache → KV → R2 → Hyperdrive”; live code is mostly **Cache → KV → Hyperdrive**. Closing that gap is part of this proposal.

---

## 3. Target architecture (proposed)

### One sentence

**Supabase stores truth; Cloudflare delivers it at edge speed; the browser keeps only RAM + an optional tiny paint hint — never a second history database.**

### Ownership matrix (what goes where)

| Data / concern | Owner | Cloudflare feature | Notes |
|----------------|--------|--------------------|-------|
| Chat rows, messages, pins, branches | **Supabase Postgres** | — | Only SoR |
| Fast SQL from Worker | **Hyperdrive** | Hyperdrive (cache **off**) | Near us-west-1; never cache mutable chat SQL in HD |
| Hot list + latest message page | **chat-history Worker** | Cache API + KV | Short TTL; invalidate on write |
| Cold / large / old transcripts | **R2** | R2 archives | Snapshot pages older than hot window |
| Binary files (images, docs, artifacts) | **R2** | r2-gateway | Already (Phase A ACL) |
| Generation lease / stop | **Durable Object** | chat-coord | Not a content cache |
| OTP / magic email | **auth-email Worker** | KV rate limits | Unchanged |
| Feature flags | **Vercel Edge Config** | — | Unchanged |
| Settings / model catalog memo | **Vercel Runtime Cache** | — | Unchanged |
| Live sidebar / multi-tab | **Supabase Realtime** | — | Mute messages while local SSE owns stream |
| Streaming generate | **Vercel** | — | Never move inference to Workers |
| Browser RAM | Client | — | Open thread + sidebar list |
| Browser IndexedDB | Client (optional) | — | **Titles + ids only**, ≤ ~100 rows, TTL hours |

### Explicitly do **not** use for chat SoR

| Avoid | Why |
|-------|-----|
| D1 as chat database | Duplicate SoR; sync hell |
| Vectorize for chat history | Wrong tool (use pgvector for RAG) |
| Zone-caching HTML `/`, `/new`, `/c/*` | Stale shells / auth bugs |
| Vercel Blob for chat binaries | R2 already owns bytes |
| Storing full message bodies in KV forever | Cost + stale; use short TTL + R2 cold |
| “Download all history to IndexedDB” | Opposite of ChatGPT/Claude model |

---

## 4. Blazing-fast read flows (target)

### 4.1 Open `/c/{chatId}` (most important)

```mermaid
sequenceDiagram
  participant UI as Browser RAM
  participant W as chat-history Worker
  participant C as Cache API / KV
  participant R as R2 cold (optional)
  participant H as Hyperdrive
  participant P as Supabase

  UI->>W: GET /v1/chats/{id}/messages?limit=… (JWT)
  W->>C: lookup hot page
  alt Cache HIT
    C-->>UI: messages (edge, ~ms)
  else Cache MISS, hot window
    W->>H: fetch_chat_messages_page
    H->>P: Postgres
    P-->>W: rows
    W->>C: fill Cache+KV
    W-->>UI: messages
  else Cold / archived page
    W->>R: archive object
    R-->>UI: messages
  end
  Note over UI: Paint immediately; no IndexedDB required
```

**Targets (directional):**

| Metric | Target |
|--------|--------|
| Hot open (Worker cache hit) | &lt; 80–150 ms TTFB to first JSON |
| Warm miss (Hyperdrive) | &lt; 250–400 ms |
| Cold archive (R2) | &lt; 300–500 ms |
| SSR seed race | Keep ≤ 120 ms soft race (optional) |

### 4.2 Sidebar list

1. Worker `GET /v1/chats` (Cache API / KV first).  
2. Paint titles/pins.  
3. Supabase Realtime `chats` → **silent** patch (no shimmer).  
4. Optional: IDB stores **only** `{ id, name, pinned, updatedAt }[]` for first paint after cold tab open — not message bodies.

### 4.3 After generate / rename / delete / pin

Vercel `after()` (already) must:

1. Persist to Postgres (truth).  
2. `POST /internal/invalidate` (list + that chat’s hot pages).  
3. `POST /internal/warm` (latest 1–2 pages + list).  
4. Update browser RAM; **do not** rewrite 40 full bodies to disk as the primary strategy.

---

## 5. Recommended Cloudflare feature use (by area)

| Cloudflare piece | Use for Clauxen | Do not use for |
|------------------|-----------------|----------------|
| **Workers** (`chat-history`) | Auth’d JSON hydrate API | Inference / SSE generate |
| **Cache API** | Hottest list + latest message page per user/chat | HTML app shells |
| **KV** | Short-TTL mirror of hot JSON; JWT memo | Permanent transcript store |
| **R2** | Attachments + **cold message archives** | Live hot path for every open |
| **Hyperdrive** | Miss path to Supabase; caching disabled | Replacing Postgres |
| **Durable Objects** (`chat-coord`) | Generation lease / stop | Message storage |
| **Queues** (optional later) | Async archive-to-R2, warm fanout | Blocking TTFT |
| **Tiered Cache / HTTP/3 / Early Hints** | Zone: static `/_next/static`, `/assets` | `/api`, `/c/*` HTML |
| **WAF / Bot** | Abuse on generate & auth | Content caching |

---

## 6. What to do with IndexedDB (decision)

### Proposal: **Device Cache v2 — paint hint only**

| Keep in IDB | Drop from IDB |
|-------------|----------------|
| Sidebar meta: last ~100 chats (id, title, pinned, updatedAt, projectId) | Full message arrays / slices |
| Optional: last **1** open chat body for crash recovery (optional, capped) | “Entire history” sync |
| `userId` scope + clear on user switch | Guest/local duplicate SoR |

**Why keep any IDB at all?**  
Only for **cold tab reopen** when the Worker is slow once (airport Wi‑Fi). ChatGPT feels fine without a full local DB because their edge is fast; we should match that, not out-local-storage them.

**Migration path:**

1. Stop writing new message bodies to IDB (feature flag).  
2. Keep list meta write.  
3. Measure open-chat p95 with Worker-only.  
4. Delete body slices from `device-chat-cache` once metrics win.  
5. Keep guest offline path quarantined (Phase B) — separate product decision.

---

## 7. Implementation plan (phased)

### Phase P0 — Align docs & metrics (1 day)

- Treat this doc as ownership truth alongside `perf-architecture.md`.  
- Add timing headers already present (`x-clauxen-cache`) to client telemetry (hit/miss/hd).  
- Confirm Hyperdrive stays **caching-disabled**.

### Phase P1 — Edge-first hydrate (core win)

1. Ensure client **always** prefers Worker for list + messages (already mostly true).  
2. Tighten TTLs for list (~60s) and latest page (~120s) with aggressive invalidate+warm.  
3. Paginate open-chat: first paint **latest N** (e.g. 40–80), scroll-up loads older (Worker cursor → then R2).  
4. Feature-flag: **disable IDB message body writes**.

**Exit:** Opening a chat does not depend on IndexedDB bodies.

### Phase P2 — Activate R2 cold archives

1. On warm/invalidate pipeline, snapshot pages older than hot window to R2 (`CHAT_ARCHIVES`).  
2. Worker GET: Cache → KV → (if cursor old) R2 → else Hyperdrive.  
3. Never put private archives in public CDN; auth same as today (JWT).

**Exit:** Long chats stay fast without stuffing KV or IDB.

### Phase P3 — Shrink device cache

1. IDB = list meta only (+ optional last-open body).  
2. Remove slice compaction complexity from hot path.  
3. Update skills / MEMORY / realtime-and-caching docs.

### Phase P4 — Optional speed polish

- CF Queues for archive + warm fanout (non-blocking).  
- Sticky Worker placement near Hyperdrive/Supabase.  
- Plan-aware page sizes.  
- Durable generate quotas (DB/KV) — complement Phase A process-local limits.

---

## 8. Comparison: current vs proposed

| Topic | Current | Proposed |
|-------|---------|----------|
| SoR | Supabase ✅ | Supabase ✅ |
| Fast path | Worker + **IDB bodies** | Worker Cache/KV (+ R2 cold) |
| Local disk | Up to 40 full chats | Titles list only (optional) |
| Long chat | Heavy IDB + Postgres | Hot edge + R2 archives |
| Multi-device | Server truth + IDB reconcile fights | Server/edge only — fewer fights |
| Mental model | “History lives on device too” | “History lives in cloud; edge delivers” |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| First open feels slower without IDB bodies | P1: warm after every generate; keep list meta IDB; measure before/after |
| Stale Cache API after write | Existing invalidate+warm must be mandatory on all mutations |
| R2 archive lag | Hot window always Hyperdrive; archive is cold-only |
| Privacy on shared machines | Less local transcript = **better**; clear IDB on logout |
| Hyperdrive cache accidentally on | Keep `--caching-disabled`; alert in ops script |

---

## 10. Recommendation (executive)

1. **Stop treating IndexedDB as chat history storage.** Supabase is enough; Cloudflare makes it fast.  
2. **Double down on `clauxen-chat-history`:** Cache API + KV hot path, Hyperdrive miss, R2 cold.  
3. **Keep Vercel for SSE generate** and DO for leases — that split is correct.  
4. **Match ChatGPT/Claude:** server truth, edge delivery, RAM UI — not a local history warehouse.  
5. Implement in order **P1 → P2 → P3**; do not boil the ocean with D1/Vectorize.

When you approve, the first build slice should be: **flag off IDB message-body writes + verify Worker hit rates on open chat**.

---

## Related docs

- [`docs/perf-architecture.md`](../perf-architecture.md)  
- [`docs/systems/realtime-and-caching.md`](../systems/realtime-and-caching.md)  
- [`docs/surveys/app-health-security-survey-2026-07-23.md`](./app-health-security-survey-2026-07-23.md)  
- `workers/chat-history/`  
- `src/frontend/lib/device-chat-cache.ts`
