# Clauxen App Health, Complexity & Security Survey

> **Path update (2026-07-24):** Repo flattened — `src/server/` (not `src/backend`), `src/components/` (not `src/frontend`), `src/marketing/` (not `src/website`), agent loop at `@/server/agent-core` (not `agent-ui` / standalone `agent-engine`).

**Date:** 2026-07-23  
**Scope:** Full-repo read-only survey (architecture, client/server wiring, dead code, security)  
**Goal:** Orient product work toward a ChatGPT/Claude-class platform: secure server-side execution, clean client UI, less dual-stack debt  
**Method:** Code graph + hot-path review. Production env values, live RLS, and Cloudflare WAF effectiveness were **not** re-validated against dashboards.

---

## 1. Executive verdict

Clauxen is already a **real triple-stack product**, not a thin chat wrapper:

| Layer | Owner | Job |
|-------|--------|-----|
| Client UI | Vercel / Next.js React | Soft-nav shell, composer, thread, overlays |
| Product APIs + SSE generate | Vercel Node routes → `src/backend` | Authz, orchestration, inference stream |
| Edge cache / blobs / leases / email / billing proxy | Cloudflare Workers | History hydrate, R2, DO lease, OTP, Razorpay |
| System of record | Supabase | Auth, Postgres, Realtime, pgvector, queues |

**What works well:** Chat spine (signed-in) is coherent; billing webhook HMAC exists; share tokens are hashed; Streamdown path sanitizes; docs + skills are unusually complete.

**What hurts most:** Dual systems (chat guest vs v1, projects microfrontend vs main app), a few **Critical** security gaps (R2 key ownership, sandbox IDOR, fail-open auth defaults), and orphan UI surfaces that advertise product buttons without backends.

**North star (your ask):** Keep **UI client-side**, keep **secrets + inference + authz + payments + storage policy server/Worker-side**, and collapse parallel stacks until there is **one** chat path and **one** projects path.

---

## 2. What the app looks like (product map)

### 2.1 Surfaces users see

| Surface | Route / entry | Primary UI |
|---------|---------------|------------|
| Chat shell | `/`, `/new`, `/c/[chatId]` | Sidebar + `ChatView` + composer + SSE thread |
| Library | `/library` | Library view |
| Projects | `/projects`, `/projects/[id]` | Projects list/detail (main app) |
| Customize | `/customize` (+ skills/connectors) | Customize catalog |
| Settings / Pricing / Apps / Gift | Hash overlays `#settings`, `#pricing`, … | Soft-nav overlays on parent page |
| Checkout | `/checkout/shirova/[sessionId]` | Razorpay UPI / card / netbanking |
| Auth | `/login`, `/auth/*`, `/onboarding` | Login + OTP/magic + onboarding |
| Marketing | `(marketing)/…`, public `/plans` | `src/website` |
| Share | `/share/[token]` | Public transcript |

Sidebar (2026-07-23): Library → My Clauxen → Scheduled Task → More (Code / Work / Claw) → collapsible Pinned / Projects / Recent chats. Several More items still toast “coming soon”.

### 2.2 Mental model (one paragraph)

A signed-in user lives in a **soft-nav chat shell**. Sending a message creates/uses a durable chat id, takes a **generation lease** (Cloudflare DO), streams **SSE** from Vercel (`agent-engine`), persists to Supabase, and hydrates later via IndexedDB + chat-history Worker. Settings/pricing are hash overlays so the chat page does not remount. Billing and file bytes leave Vercel for Workers when appropriate; Postgres remains SoR.

---

## 3. Client vs server wiring (target architecture)

```
Browser (React "use client")
  ├─ Soft-nav / hash overlays / IndexedDB device cache
  ├─ Consume SSE + render markdown/tools
  └─ JWT Bearer → CF Workers (history, R2 PUT)
         │
         ▼
Vercel Next.js
  ├─ App Router pages (thin shells)
  ├─ /api/v1/* (self-auth; Edge proxy skips /api)
  ├─ SSE generate (maxDuration ~300s)
  └─ after() background jobs
         │                    │
         ▼                    ▼
Supabase (SoR)          Cloudflare Workers / R2 / DO
```

### Hard rules (keep)

| Must stay server / Worker | May stay client |
|---------------------------|-----------------|
| Provider API keys (`Provider_*`) | Soft-nav, optimistic UI |
| Service role / DB pooler | Theme, draft text, local preferences |
| Razorpay secret + webhook verify | Composer UX, attachment pickers |
| Authz / ownership checks | Markdown render (but sanitize) |
| Inference + tool execution | Stream consumption |
| R2 policy + key scoping | Display of signed/proxied URLs |
| Plan quotas / rate limits | |

### Repo map (781 TS/TSX files under `src/`)

| Path | Role |
|------|------|
| `src/app/` | Routes + API handlers |
| `src/` | Client UI / hooks / contexts |
| `src/server/` | Services, repos, inference |
| `src/app/agent-ui/` | Parallel agent package (mostly deprecated HTTP) |
| `src/projects/` | Legacy projects microfrontend + RAG libs |
| `src/marketing/` | Marketing |
| `workers/` | Five CF Workers |
| `vendor/clauxen-code-agent/` | Reference CLI agent (~5MB, not imported) |
| `skills/` + `docs/` | Agent skills + product docs |

---

## 4. Chat spine (critical path)

**Signed-in happy path**

1. Composer (`prompt-input.tsx`) → optimistic rows  
2. `ChatSessionProvider` → `useChatApi` (~2373 LOC)  
3. `POST /api/v1/chats` → soft-nav `/c/{id}`  
4. Lease via `chat-coord` DO  
5. `POST /api/v1/chats/[chatId]/generate` → `chat.service` → `agent-engine` SSE  
6. Client parse (`chat-stream` / `agent-stream-reducer`) → thread UI  
7. Persist + warm history Worker; Realtime muted while this tab owns SSE  

**Spine files**

| Layer | Path |
|-------|------|
| Client God-hook | `src/hooks/use-chat-api.ts` |
| Generate route | `src/app/api/v1/chats/[chatId]/generate/route.ts` |
| Orchestration | `src/server/services/chat.service.ts` |
| Agent loop | `src/server/inference/agent-engine.ts` |
| Lease | `workers/chat-coord` + `generation-registry.ts` |
| History edge | `workers/chat-history` |

**Complexity hotspot:** `use-chat-api.ts` alone is the highest product-risk module (list, hydrate, send, SSE, branch/edit, pin, Realtime mute, device cache). Treat changes as high-ceremony.

---

## 5. Complexity & dual-system debt

### 5.1 Dual chat stacks — **HIGH**

| Path | Status |
|------|--------|
| `useChatApi` + `/api/v1/chats/*/generate` | Canonical signed-in |
| `useChat` / `useLocalChat` + `/api/chat` (~1439 LOC) | Parallel guest/local stack still compiled |
| `src/app/agent-ui/` + `/api/autonomous-agent/**` | HTTP returns **410**; package still in tree |
| `vendor/clauxen-code-agent` | Comment-only reference |

Main shell always uses `useChatApi` when authenticated. Local path still exists for project/`apiEnabled=false` and historical guest mode → cognitive load + drift risk.

### 5.2 Dual projects systems — **HIGH**

| Layer | Status |
|-------|--------|
| Main UI → `/api/v1/projects` | Active (sidebar + pages) |
| Project files in main UI | Still partly **localStorage** (“temporary”) |
| `/api/projects/**` + `src/projects/frontend/**` | **Orphaned from product UI** (no importers outside itself) |
| BullMQ `scripts/worker.ts` + RAG ingest | Wired only to legacy `/api/projects` file pipeline |

Result: marketed “projects RAG” docs describe a stack the main sidebar does not fully use.

### 5.3 Orphan / unwired UI — **HIGH–MED**

Likely unwired (definition-only or self-contained trees):

- `agent-swarm/*`
- `voice-call.tsx`, `voice-recorder.tsx`, `voice-settings-sidebar.tsx`
- `clauxen-claw-view.tsx`, `artifacts-view.tsx`, `deep-research-view.tsx`, `featured-agent-cases.tsx`
- `context-usage-panel.tsx`, `message-skeleton.tsx`, `follow-up-suggestions.tsx`, `chat-options-menu.tsx`
- Unused settings leftovers (`data-controls-settings`, `connectors-settings`, stubs for Reflect / Parental / Trusted contact)
- Several unused `ui/*` shadcn kits (`calendar`, `chart`, `badge`, …)

Sidebar More items (Work / Claw / Scheduled) currently toast “coming soon” while orphan views sit unused.

### 5.4 Other debt

| Item | Severity | Notes |
|------|----------|-------|
| Login-demo (~1.8k LOC + 50+ CSS rules) | MED | Ships on public `/login` chunk |
| Settings stub tabs | MED | Reflect / parental / trusted are placeholders |
| `@deprecated` aliases (~44) | MED | Many still imported as soft aliases |
| `TODO`/`FIXME` | LOW | Almost none (good discipline) |
| Marketing scrape scripts under `scripts/` | LOW | One-off competitor inventories |
| `workers/` disk size | INFO | ~692MB (includes Worker `node_modules`); not all source |

### 5.5 Hotspot LOC (approx.)

| LOC | File |
|----:|------|
| 2373 | `use-chat-api.ts` |
| 1717 | `billing-checkout.tsx` |
| 1578 | `conversation-thread.tsx` |
| 1465 | `prompt-input.tsx` |
| 1439 | `use-chat.ts` (local/guest) |
| 1041 | `sidebar.tsx` |
| 931 | `agent-engine.ts` |
| 907 | `chat.service.ts` |

---

## 6. Security survey (prioritized)

> Honesty: findings are **code-verified** unless marked inferred. Production env actual values were not fetched this pass.

### Critical

| # | Issue | Evidence | Fix direction |
|---|--------|----------|---------------|
| C1 | **R2 gateway: no key ownership** — any valid JWT can PUT/GET/DELETE arbitrary `bucket`+`key` | `workers/r2-gateway/src/index.ts` accepts client key; no `users/${sub}/` prefix check | Enforce user-prefixed keys; short-lived scoped URLs |
| C2 | **R2 downloads public edge-cached** | `Cache-Control: public, max-age=31536000` + Cache API on `/download/*` | `private`/`no-store` or signed URLs; never public cache for user objects |
| C3 | **Sandbox IDOR** — ops by `sandboxId` with no `metadata.userId === session.id` | `/api/v1/sandbox/[sandboxId]/**` use `requireChatAuth` only | Ownership check on every sandbox route |
| C4 | **Fail-open chat auth default** | `AUTH_REQUIRED_FOR_CHAT` defaults `"false"` in `env.ts` | Default `true`; use `requireAuth` on all inference/sandbox/agent routes |
| C5 | **Agent `web_fetch` SSRF fallback** | Raw `fetch(url)` after Exa fail in autonomous tools executor | Exa-only or locked egress; deny private/metadata ranges |

### High

| # | Issue | Fix direction |
|---|--------|---------------|
| H1 | `AUTH_DEV_BYPASS` treats cookie as unsigned user id; defaults on off-Vercel | Fail closed in prod; signed local-only bypass |
| H2 | UPI QR image route: auth without order ownership | Join `billing_orders` by qr id + `user_id` |
| H3 | XSS: `rehypeRaw` without sanitize on ReactMarkdown path | Remove raw HTML or add `rehype-sanitize`; prefer Streamdown |
| H4 | No app-level rate/quota on generate | Per-user caps + plan gates before stream |
| H5 | Some Workers: non–timing-safe token compare + CORS `*` | `timingSafeEqual`; require `APP_ORIGIN` |

### Medium / Low (selected)

- Auth `next` redirect sanitizer weaker than Razorpay callback (`\`, `@`)  
- CSP allows `unsafe-inline` / `unsafe-eval` (Razorpay-driven)  
- Shallow bash denylist + prompt-injection → tool risk  
- Webhook HMAC OK; durable event-id replay window unclear  
- Committed infra identifiers / live Razorpay **key id** in memory/docs (noise; rotate if ever leaked as secret)

### Positive controls already in place

- Razorpay webhook HMAC + timing-safe compare  
- Billing Worker internal auth (timing-safe)  
- Chat/project repos generally scope by `user.id` (sampled)  
- Share tokens high-entropy + hashed  
- Streamdown harden/sanitize path  
- `scripts/audit-public-env.mjs` for `NEXT_PUBLIC_*`  
- API keys hashed (`clx_…`)

---

## 7. How this compares to ChatGPT / Claude platform goals

| Capability | ChatGPT/Claude class target | Clauxen today |
|------------|-----------------------------|---------------|
| Streaming chat + tools | Server-orchestrated SSE | **Strong** (v1 path) |
| History hydrate at edge | Fast list/open | **Strong** (Worker ladder + IDB) |
| Projects / memory / files | One backend story | **Split** (v1 CRUD vs orphan RAG stack) |
| Product nav (Code / Work / scheduled) | Real surfaces | **Buttons ahead of backends** |
| Abuse / plan gating | Hard server quotas | **Weak in app code** |
| Attachment privacy | Strict object ACL | **R2 ACL gap (Critical)** |
| Client never holds secrets | Strict | **Mostly good**; keep auditing |

---

## 8. Recommended next direction (sequenced)

Work in **focused slices**. Do not boil the ocean.

### Phase A — Security hardening (do first)

**Status (2026-07-23): implemented in code** — redeploy `clauxen-r2-gateway` Worker for R2 ACL/cache fix to take effect in production.

1. ~~R2 key ownership + private cache (`workers/r2-gateway`)~~ ✅  
2. ~~Sandbox ownership checks on every route~~ ✅  
3. ~~Fail-closed auth defaults (`AUTH_REQUIRED_FOR_CHAT=true`, `requireAuth` on inference/sandbox/agent)~~ ✅  
4. ~~Lock down `web_fetch` (no raw SSRF fallback)~~ ✅  
5. ~~Guard/disable `AUTH_DEV_BYPASS` outside local~~ ✅  
6. ~~UPI QR ownership + drop unsafe `rehypeRaw`~~ ✅  
7. ~~Generate rate limits (process-local user/IP windows)~~ ✅ — durable plan quotas still follow-up  

**Exit criteria:** No authenticated user can read another user’s R2 object or drive another user’s sandbox; unauthenticated inference is impossible in all deploys.

### Phase B — Collapse dual stacks

1. **Chat:** Quarantine or delete `useLocalChat` + `/api/chat` if guest mode is not a product goal; keep IndexedDB only as signed-in device cache.  
2. **Projects:** Choose one — wire main UI to real files/RAG APIs **or** archive `/api/projects` + `src/projects/frontend` and implement files on `/api/v1/projects`. Stop localStorage-as-SoR.  
3. **Agent:** Keep `agent-engine` as sole runtime; archive `src/autonomous-agent` if 410 APIs are final; `.cursorignore` vendor CLI tree.

**Exit criteria:** One chat generate path, one projects API tree, CI fails on new dual entrypoints.

### Phase C — Product UI honesty

1. Delete or quarantine orphan views (voice, agent-swarm, claw/artifacts/deep-research) **or** wire them behind real routes.  
2. Settings: hide stub tabs (Reflect / Parental / Trusted) until implemented.  
3. Sidebar More items: only show when a surface exists; keep “coming soon” out of primary nav if possible.  
4. Code-split login-demo off the critical auth CSS path.

**Exit criteria:** Every sidebar label maps to a real, secured surface or is removed.

### Phase D — Complexity reduction on the hot path

1. Split `use-chat-api.ts` into modules (list, hydrate, send/stream, mutations) without behavior change.  
2. Extract checkout payment methods from `billing-checkout.tsx`.  
3. Scrub `@deprecated` re-exports once call sites migrate.  
4. Keep implementing product slices one at a time (MEMORY rule).

### Phase E — Platform features (after A–C)

Suggested order once foundation is clean:

1. **My Clauxen** (personalization/customize home) — already partly there  
2. **Projects files + RAG** on the canonical API  
3. **Clauxen Code** settings + CLI pairing (settings tab exists)  
4. **Scheduled Task** + **Clauxen Work / Claw** as real product surfaces  
5. Plan entitlements enforced server-side on generate/tools  

---

## 9. Issue backlog (quick triage board)

| ID | Area | Severity | Summary |
|----|------|----------|---------|
| SEC-R2 | Storage | Critical | R2 arbitrary key + public cache |
| SEC-SBX | Sandbox | Critical | Missing ownership |
| SEC-AUTH | Authz | Critical | Fail-open `AUTH_REQUIRED_FOR_CHAT` |
| SEC-SSRF | Tools | Critical | `web_fetch` raw fetch |
| SEC-BYPASS | Auth | High | Unsigned bypass cookie |
| SEC-UPI | Billing | High | QR image IDOR |
| SEC-XSS | Frontend | High | `rehypeRaw` unsanitized |
| SEC-RATE | Abuse | High | No generate quotas |
| DEBT-CHAT | Dual stack | High | Guest `/api/chat` + `useLocalChat` |
| DEBT-PROJ | Dual stack | High | Orphan `/api/projects` + localStorage files |
| DEBT-UI | Dead code | High | Orphan voice/swarm/claw/artifacts views |
| DEBT-SET | Settings | Med | Stub tabs still in nav |
| DEBT-DEMO | Bundle | Med | Login-demo weight on public route |
| DEBT-VENDOR | Repo | Med | 5MB unused vendor agent tree |
| COMP-HOOK | Complexity | Med | `use-chat-api` God-hook |

---

## 10. How to use this document

- **Product / eng planning:** Section 8 phases  
- **Security sprint:** Section 6 Critical → High  
- **Cleanup PRs:** Section 5 + backlog `DEBT-*`  
- **Architecture truth:** Prefer this survey + `docs/architecture-overview.md` + `brain/MEMORY.md` decisions  

When a phase completes, update this file’s status table (or add a dated follow-up under `docs/surveys/`) and add a one-line decision to `brain/MEMORY.md`.

---

## 11. Coverage honesty

| Area | Depth this pass |
|------|-----------------|
| Architecture / dual stacks / orphan UI | Thorough (import graph + route map) |
| R2 / sandbox / auth defaults / markdown XSS | Code-verified |
| Production Vercel/CF env actual values | Not live-checked |
| Supabase RLS advisor | Not run |
| Exploit PoCs | Not executed (read-only) |

---

*Generated 2026-07-23 as an internal engineering survey for Clauxen → ChatGPT/Claude-class platform readiness.*
