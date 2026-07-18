# Complete Product Deep Dive

This document is a high-distillation companion that walks every major product surface end-to-end, with glossary, decision rationale, payload sketches, and operational checklists. It complements (does not replace) the focused system docs under `docs/systems/` and `docs/reference/`.

**Audience:** engineers, agents, and operators onboarding to Clauxen.

**Last rewritten:** 2026-07-17.

---

## Part A — Product narrative

Clauxen is an AI chat platform positioned for ChatGPT/Claude-class interaction quality with India-aware checkout (Razorpay/UPI), Supabase-backed durability, and Cloudflare edge acceleration. The product is built incrementally (auth → onboarding → billing → settings → projects → chat → customize → …) but the codebase already contains broad surface area. Roadmap items that are not fully wired should still be documented against their intended tables and routes so future slices land in the right place.

The engineering strategy that makes the product feel fast is **ownership clarity**:

1. Vercel runs the interactive app and streams tokens.
2. Cloudflare caches history and serves blobs + leases + email.
3. Supabase stores truth and pushes Realtime.

When those boundaries blur (e.g., caching HTML shells at CF, or putting vectors in Vectorize, or putting blobs in Vercel Blob), latency and cost regressions follow. The docs in `perf-architecture.md` and this deep dive exist to prevent that.

---

## Part B — Glossary

| Term | Meaning |
|---|---|
| **Triple-stack** | Vercel + Cloudflare + Supabase ownership split |
| **Device cache** | Per-user IndexedDB mirror of chat list + bodies |
| **Seed race** | ≤120ms SSR attempt to seed `/c/[id]` without shimmer |
| **clientId** | Stable client message id for React keys / stream association |
| **Lease** | Durable Object lock preventing concurrent generates per chat |
| **Hash overlay** | `#settings/…` UI on top of parent route |
| **Soft-nav** | pushState + Next soft sync via `useInstantNavigate` |
| **Quiet session** | `GET /session?quiet=1` — fast FCP without profile sync |
| **Worker ladder** | Cache API → KV → R2 → Hyperdrive |
| **Fail closed** | Missing provider/tool secrets → error, not silent degrade to hardcoded keys |
| **sanitizeBranchMessages** | Branch PUT sanitizer that preserves ids/frames |
| **agent_ui** | content_json timing for Thought/Worked labels |
| **Follow-up tags** | `<prompt>…</prompt>` extracted to buttons |
| **pgmq** | Postgres message queue for background chat jobs |
| **clx_ key** | Programmatic API key prefix |
| **AUTH_DEV_BYPASS** | Local cookie session path |
| **Managed Challenge** | CF bot challenge; may POST to documents |
| **Verified commits** | GitHub SSH-signed commits required by Vercel |
| **Sensitive env** | Vercel env type for prod/preview secrets |
| **Encrypted env** | Vercel env type required for Development secrets |
| **Hyperdrive** | CF Postgres acceleration / pooling to Supabase |
| **r2-gateway** | Auth-gated Worker for R2 PUT/GET |
| **chat-history** | Edge read Worker for chats/messages |
| **chat-coord** | DO Worker for generation leases |
| **auth-email** | OTP/magic Worker via Email Sending |
| **Virgil** | Default persona system prompt card |
| **Personalization modules** | Modular `.md` style instructions |
| **RAG** | Retrieval-augmented generation via pgvector |
| **Transcript JSONL** | Training export format in chat_transcript_lines |

---

## Part C — End-to-end scenarios

### C1. Brand-new visitor → first chat

1. Hit `/` → identity resolution → soft-replace `/new`.
2. If `AUTH_REQUIRED_FOR_CHAT` and anonymous → prompt login.
3. Login unified email → OTP or password → optional onboarding.
4. Land `/new` with empty composer.
5. Type message + optional attachments.
6. Optimistic user+assistant rows appear (`clientId`s).
7. `POST /api/v1/chats` returns durable text id.
8. Instant navigate `/c/{id}`.
9. Lease acquired; SSE generate starts; orb visible.
10. Tokens stream; tools may run; follow-up chips may appear.
11. Complete → transcript lines → warm history → title `after()`.
12. Sidebar shows chat; device cache written.

**Failure injections to test:** provider 401, lease 409, upload without WORKER_URL, CF challenge POST.

### C2. Return visitor opens old chat

1. Sidebar list from device meta / Worker list cache.
2. Click row → soft-nav `/c/{id}`.
3. Body from IndexedDB if warm; else SSR seed ≤120ms; else shimmer.
4. Silent Worker reconcile full thread (≤500).
5. Realtime joins for multi-tab.
6. Send follow-up — stream mute Realtime messages.

### C3. Edit → branch

1. Click user bubble → inline editor.
2. Modify text/attachments; send.
3. `editMessageWithBranch` creates branch; PUT branches with `sanitizeBranchMessages`.
4. Reload — single coherent thread, no duplicate assistants.

### C4. Settings personalization

1. From `/c/{id}` open `#settings/Personalization` via pushState.
2. Change base style + warm more + custom instructions.
3. PATCH settings; close overlay — still on same chat.
4. Next generate includes modular instructions + append.

### C5. Project RAG ask

1. Create project; upload PDF via project files.
2. Worker ingests → chunks/embeddings.
3. New chat in project; ask question.
4. Retrieve top chunks; answer with citations.

### C6. Upgrade with UPI

1. Open `#pricing`.
2. Select INR plan; UPI method visible (India heuristic).
3. Create UPI order; scan QR; poll.
4. Webhook activates subscription.

### C7. Gift redeem

1. Purchase gift → code emailed/delivered via job.
2. Redeem endpoint → subscription_activation_events.

### C8. Share chat

1. Share dialog → token.
2. Incognito `/share/{token}` read-only.

### C9. Programmatic Messages API

1. Create `clx_…` key.
2. `POST /api/shirova/v1/messages` Anthropic-compatible body.
3. Observe gateway/request logging tables if enabled.

### C10. Stop mid-tool

1. Start thinking+tools turn.
2. Hit stop → generate/stop → coord stopRequested.
3. Assistant cancelled; lease released; UI shows partial/cancelled.

---

## Part D — Decision distillation (from project memory)

The following decisions are durable product law. Full table lives in `brain/MEMORY.md`; distilled here for docs readers.

### Detailed decision rationales

#### Optimistic pin/rename/title

Pin overrides and titles update the UI immediately and persist asynchronously. The UI keeps local pin overrides until the server list agrees, because Hyperdrive/list cache lag would otherwise yank chats between Pinned and New chat sections.

#### Sidebar hover continuous pill

Global button:hover CSS painted nested backgrounds under pin/more controls, visually splitting the row highlight. Hover must be one continuous pill on the row container; nested action buttons must not paint their own hover wash.

#### Vercel env shape

Production and Preview use Sensitive env vars; Development must use Encrypted because the Vercel API forbids Sensitive on Development. Reconcile scripts enforce this shape across all three targets for every key.

#### Terminal SSE errors visible

If the SSE parser catches consumer errors and continues, provider failures become blank completed assistant messages. Terminal errors must propagate into visible failure text persisted on the assistant row.

#### Mute Realtime during SSE ownership

While a tab owns generation, mute chat_messages Realtime except id remaps. Empty WAL updates were clearing the streaming orb mid-turn — ChatGPT/Claude treat the stream as UI source of truth.

#### Live stream wins dedupe

Empty completed rows from cold server/IDB snapshots must not outrank a live streaming assistant. Scoring in dedupe/hydrate prefers the live stream so the orb survives new-chat and follow-up.

#### Device IndexedDB cache

Signed-in users get a per-user IndexedDB cache of the chat list plus up to 40 bodies, reconciled silently via Worker. This cuts origin load without polling; server remains truth.

#### Skip Argo unless asked

Free-zone speed settings (HTTP/3, Early Hints, Tiered Cache, Cache Rules) are enough. Argo is optional paid and must not be enabled unprompted.

#### Triple-stack ownership

Vercel owns stream + Edge Config + Runtime Cache. CF owns history Worker + R2 + DO lease + zone. Supabase owns truth + Realtime + pgvector + pgmq. Avoid duplicate caches/storage; R2-only files; no Vectorize/Blob on product path.

#### Sidebar selection highlight

Selection highlight belongs on the row container only. Global button[aria-current=page] styles nested a second pill inside the selected row.

#### No loading.tsx on chat routes

loading.tsx plus long SSR seed waits caused post-create shimmer. Soft-nav must keep optimistic chat-view; seed race ≤120ms.

#### CF Free security pack

Five custom rules: Managed Challenge on HTML entry; Block scanners/empty-UA/sensitive paths; Challenge suspicious auth POSTs; SSL Full strict; AI Labyrinth; Block AI Training; Browser Integrity Check; Under Attack off.

#### Unified login

Continue with Email checks existence then password login or create+OTP via auth-email Worker. Separate signup surface removed; /signup redirects to /login.

#### Auth OTP via Worker

Production signup OTP uses clauxen-auth-email + Cloudflare Email Sending from no-reply@clauxen.com with Vercel AUTH_EMAIL_*.

#### Magic link signup

New users get a 5-minute magic link to /auth/magic for set-password then onboarding. Existing-user magic login deferred.

#### Settings profile persistence

Names/work/custom instructions persist to profiles + user_settings; custom instructions append under Shirova guidelines in the system prompt.

#### Personalization modular md

Style/characteristics use modular .md instructions; Personality UI removed as duplicate of base style; virgil.md must not hardcode warm/emoji/list personality.

#### General prefs applied to DOM

AppPreferencesProvider applies theme/font/motion/follow-ups to html attributes and persists settings.general — prefs must not be save-only.

#### Hash overlays

Settings/pricing/gift/apps use ChatGPT-style hashes on parent pages. Legacy path overlays blanked the main panel and forced close→/new.

#### Verified commits

Vercel Require Verified Commits is ON; GitHub must show Verified via SSH signing key uploaded separately from auth key.

#### Notifications optimistic

Push/Email toggles persist optimistic without PATCH response overwrite to avoid 2–4s flicker.

#### Instant navigate on chat create

New-chat navigates the instant durable chat id exists; do not await message persist. handleSelectChat never lets sparse SSR seed wipe live turns.

#### Agentic frame timing

Live Label · duration while streaming; thinking-only → Thought for Ns; tools → Worked for …; persist agent_ui on content_json.

#### Follow-ups as prompt tags

Extract <prompt> tags into buttons; never markdown clauxen-prompt:// links (rehype-harden shows [blocked]). Single activity frame per turn.

#### RAM eviction omit keys

Eviction omits messageIds keys (not empty arrays) so Recents filter does not hide switched-away chats.

#### Chat ids text

chats.id is text with generateChatId long-form ids verified unique; requireChatIdParam validation.

#### Full-thread hydrate

Hydrate via Worker listAllChatMessages limit 500; no scroll-up pagination UI.

#### Provider_* naming

Inference uses Provider_API_Key / Provider_BASE_URL / Provider_Model_Clauxen_V1 server-only Sensitive.

#### Proxy skips /api session

Edge proxy skips updateSession for /api/* to cut stacked TTFB on /c cold loads.

#### CF challenge POST→GET

Managed Challenge POSTs to documents converted to 303 GET in proxy; do not weaken CF rules.

---

## Part E — Payload sketches

### E1. Create chat

`POST /api/v1/chats`

```json
{
  "title": null,
  "projectId": null,
  "model": null
}
```

Response includes `{ "id": "<long-text-id>", ... }`.

### E2. Generate

`POST /api/v1/chats/{id}/generate`

```json
{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "" }
  ],
  "turn": {
    "content": "Hello",
    "userClientId": "c_user_…",
    "assistantClientId": "c_asst_…",
    "fileIds": []
  },
  "generateChatTitle": true
}
```

Response: `text/event-stream`.

### E3. Presign upload

`POST /api/v1/files/presign`

```json
{
  "filename": "spec.pdf",
  "contentType": "application/pdf",
  "byteSize": 12345,
  "purpose": "chat_attachment"
}
```

Response includes Worker URL + file id; client PUTs with Bearer access token.

### E4. Settings patch

`PATCH /api/v1/settings`

```json
{
  "settings": {
    "general": {
      "theme": "system",
      "chatFont": "inter",
      "followUpSuggestions": true
    },
    "personalization": {
      "baseStyle": "friendly",
      "warm": "more",
      "customInstructions": "Be concise."
    }
  }
}
```

### E5. Checkout order (sketch)

`POST /api/v1/billing/orders`

```json
{
  "planId": "…",
  "currency": "INR",
  "method": "upi"
}
```

Exact fields follow `billing.service` validators — consult route handlers when integrating.

### E6. Worker invalidate

`POST {CHAT_HISTORY_WORKER_URL}/internal/invalidate`

Headers: `x-clauxen-internal: …`

```json
{ "chatId": "…", "userId": "…" }
```

---

## Part F — Module responsibility matrix

| Concern | Frontend | Backend | Worker | DB |
|---|---|---|---|---|
| Render chat | ChatView | — | — | — |
| Send message | use-chat-api | chat.service | — | chat_messages |
| Stream tokens | SSE consumer | inference/* | — | streaming status |
| Stop | stop button | stop route | chat-coord | — |
| Hydrate | device cache | seed loader | chat-history | fetch RPC |
| List sidebar | sidebar | chats list API | chat-history list | chats |
| Upload | composer | files.service | r2-gateway | user_files |
| OTP | login UI | auth-email service | auth-email | auth.users |
| Title | title UI | after()/title API | invalidate | chats.title |
| Pin | optimistic UI | pin route | list invalidate | pinned_chats |
| RAG | project UI | project-rag | — | embeddings |
| Billing | checkout UI | billing.service | — | subscriptions |
| Flags | — | readEdgeFlags | — | Edge Config |

---

## Part G — Performance budget notes

Targets and metrics: see `perf-metrics.md`. Engineering levers:

1. Device cache for return opens
2. Worker ladder for hydrate
3. Skip /api session refresh in proxy
4. Quiet session for FCP
5. RAM window + LOD for long threads
6. Streamdown CSS idle load
7. Overlay code-split
8. Generate memory 1024 / 300s; default API 512
9. Region pdx1 near us-west-1
10. Pool max 1 per isolate

Anti-patterns:

- Zone-caching `/c` HTML
- Polling chat list
- Re-importing streamdown CSS in main layout
- loading.tsx on chat routes
- Blocking title generation on TTFT path
- Double-caching same content on KV and Runtime Cache for identical keys without invalidation plan

---

## Part H — Accessibility & UX polish checklist

- Document titles hyphenated and live-updated
- Focus management in inline edit (preventScroll; blur on scroll so sticky edit cannot trap)
- Click agent-panel (not sidebar) collapses edit
- Auth text links use `.auth-text-link`
- Assistant fonts only on `[data-assistant-content]`
- Reduced motion preference honored via AppPreferences
- Share dialog keyboardable
- Stop button available during stream
- Error text never empty on failed generations

---

## Part I — Data retention & training

- Transcripts stored in `chat_transcript_lines` for potential training/export
- Consent/governance tables exist for model training priority
- Privacy settings expose export/deletion request jobs
- Shared chats must not expose private attachments beyond share policy
- Operators exporting transcripts: `GET /api/v1/chats/:id/transcript`

---

## Part J — Multi-tab correctness

1. Only one lease per chat globally (DO)
2. Tab that owns SSE mutes Realtime message noise
3. Other tabs may see completed rows via Realtime after finalize
4. Id remaps must update generation maps in the owning tab
5. Presence via Broadcast, not postgres_changes

---

## Part K — Model prompt layering diagram

```
┌─────────────────────────────────────────┐
│ virgil.md / selected persona card       │
├─────────────────────────────────────────┤
│ personalization/base-style/*.md         │
│ + warm/enthusiastic/headers/emoji       │
├─────────────────────────────────────────┤
│ user custom instructions + occupation   │
├─────────────────────────────────────────┤
│ capabilities (web, canvas, connectors)  │
├─────────────────────────────────────────┤
│ follow-up instruction (optional)        │
├─────────────────────────────────────────┤
│ project instructions + RAG chunks       │
├─────────────────────────────────────────┤
│ tool schemas / autonomous steering      │
└─────────────────────────────────────────┘
```

---

## Part L — File type matrix

| Type | Composer | Project ingest | Vision | Text extract |
|---|---|---|---|---|
| PNG/JPEG/WebP | yes | yes | yes | n/a |
| PDF | yes | yes | limited | pdf-parse |
| DOCX | text path | yes | no | mammoth |
| TXT/MD/CSV | yes | yes | no | direct |
| Skill zip | customize upload | n/a | n/a | skill catalog |

---

## Part M — HTTP status conventions

| Code | Typical meaning |
|---|---|
| 200 | OK / SSE open |
| 303 | CF challenge POST converted to GET |
| 400 | Validation (`invalid_turn`, bad body) |
| 401 | Missing/invalid session |
| 403 | Forbidden (RLS / ownership) |
| 404 | Not found |
| 409 | `generation_in_progress` lease conflict |
| 503 | `auth_unavailable`, `maintenance_mode` |

---

## Part N — Local vs production matrix

| Concern | Local | Production |
|---|---|---|
| Auth | AUTH_DEV_BYPASS cookie OK | GoTrue only |
| Storage | disk fallback possible | R2 + WORKER_URL required |
| History Worker | optional | required for scale |
| Coord Worker | optional (single isolate) | required multi-isolate |
| Auth email | AUTH_DEV_BYPASS simulate | Worker + Email Sending |
| Redis | optional inline | recommended for ingest |
| Env secrets | .env.local | Vercel sensitive/encrypted |
| Commits | — | must be Verified |

---

## Part O — Sidebar state machine (conceptual)

```
[empty] --first fetch--> [shimmer] --list arrives--> [idle]
[idle] --realtime chats--> [idle] (silent refresh)
[idle] --open chat--> [active row]
[idle] --pin optimistic--> [pinned local] --server agrees--> [pinned]
[idle] --send new--> [shimmer until id+msg] --ready--> [idle]
```

---

## Part P — Generate state machine (conceptual)

```
idle -> leasing -> streaming -> finalizing -> idle
                 \-> 409 conflict
streaming -> stop_requested -> cancelled
streaming -> provider_error -> error_visible
finalizing -> warm_cache -> title_job -> idle
```

---

## Part Q — Security review prompts for PRs

When reviewing a PR, ask:

1. Any new `NEXT_PUBLIC_` secret?
2. Any new SECURITY DEFINER RPC without EXECUTE revoke?
3. Any new binary store not R2?
4. Any new cache without invalidation?
5. Does chat stream still fail visible?
6. Do overlays still use hashes?
7. Are clientIds preserved across remaps?
8. Is branch sanitize correct?
9. Are Worker internal tokens rotated in all targets?
10. Does CF challenge proxy still handle POSTs?

---

## Part R — Operator daily checklist

- [ ] Vercel deployments healthy (not canceled unverified)
- [ ] Worker `/health` endpoints OK
- [ ] Auth email deliverability (spot check)
- [ ] Razorpay webhooks succeeding
- [ ] Supabase advisors clean enough
- [ ] Error budgets / Speed Insights within targets
- [ ] No accidental Argo/billing addons

---

## Part S — Extended FAQ

**Why text chat ids?** Shareable ChatGPT-style URLs without exposing sequential integers; uniqueness verified.

**Why mute Realtime?** Stream is source of truth; WAL empties fought the orb.

**Why portal overlays?** Transform on agent-panel creates containing block for fixed.

**Why not loading.tsx?** It remounted shells and caused shimmer after create.

**Why sanitizeBranchMessages?** sanitizeMessages stripped ids → duplicate assistants on reload.

**Why device cache if Worker exists?** Instant paint on repeat opens; Worker still reconciles.

**Why pdx1?** Near Supabase us-west-1 for DB RTT.

**Why fail closed on keys?** Hardcoded fallbacks leak and mask misconfig.

**Why hash overlays?** Keep chat mounted; path overlays blanked main panel.

**Why KV TTL ≥ 60?** Cloudflare KV rejects shorter expirationTtl.

**Why no Vectorize?** pgvector already in Supabase; avoid dual vector planes.

**Why no Vercel Blob?** R2 already owned; Blob duplicates cost/path.

**Why verified commits?** Org policy; unverified auto-canceled.

**Why quiet session?** Profile sync was on critical path for FCP.

**Why one chronological agent trace?** It preserves the actual thinking → narration → tool order without stacking synthetic status chips.

**Why persist exact Anthropic model turns?** Thinking signatures and redacted blocks must be replayed unchanged around tool results; flattening them loses reasoning continuity.

**Why prompt tags not links?** rehype-harden blocks custom protocols as `[blocked]`.

**Why India heuristic for UPI?** Geo IP can misclassify and hide UPI wrongly.

**Why omit messageIds on eviction?** Empty array meant “no messages” to Recents filter.

**Why service_role for chat RPCs?** SECURITY DEFINER must not be callable by anon.

**Why skip /api in proxy?** Handlers auth themselves; double getUser stacked TTFB.

---

## Part T — Code reading order for new engineers

1. `docs/README.md` → `architecture-overview.md` → `perf-architecture.md`
2. `src/frontend/lib/app-routes.ts`
3. `src/frontend/hooks/use-chat-api.ts` (skim sections)
4. `src/app/api/v1/chats/[chatId]/generate/route.ts`
5. `src/backend/services/chat.service.ts`
6. `workers/chat-history/README.md` + `workers/chat-coord/README.md`
7. `src/backend/auth/*` + `docs/systems/authentication.md`
8. `supabase/migrations/20260507153000_platform_schema.sql` (base)
9. `brain/MEMORY.md` gotchas

---

## Part U — Surface inventory (pages)

| Path | Purpose |
|---|---|
| `/` | Main boot → /new |
| `/new` | Blank chat |
| `/c/[chatId]` | Chat by id |
| `/library` | Library |
| `/projects` | Projects list |
| `/projects/[id]` | Project detail |
| `/projects/[id]/conversations/[convId]` | Project conversation |
| `/customize` | Customize hub |
| `/customize/skills` | Skills |
| `/customize/connectors` | Connectors |
| `/settings` | Legacy settings → hash |
| `/settings/[tab]` | Legacy settings tab → hash |
| `/upgrade` | Legacy pricing → hash |
| `/pricing` | Legacy pricing |
| `/gift` | Legacy gift → hash |
| `/apps` | Legacy apps → hash |
| `/login` | Unified login |
| `/signup` | Redirect login |
| `/onboarding` | Onboarding |
| `/auth/callback` | OAuth callback |
| `/auth/confirm` | Email confirm |
| `/auth/magic` | Magic set-password |
| `/auth/reset-password` | Reset password |
| `/share/[token]` | Public share |
| `/checkout/[merchant]/[sessionId]` | Checkout |
| `/about` | About |
| `/legal/privacy` | Privacy |
| `/legal/terms` | Terms |


---

## Part V — API domain inventory (compressed)

Auth, Profile, Onboarding, Settings, Chats, Files, Projects (v1+legacy), Billing, Gifts, Customize, Sandbox, Agent, Autonomous Agent, Shirova Messages, Novita helpers, Workspaces, Research, Artifacts, API Keys, Geo, Webhooks, Well-known.

Full tables: [`reference/api-reference.md`](./reference/api-reference.md).

---

## Part W — Database domain inventory (compressed)

Identity (profiles, security events), Workspaces (members, domains, SSO, SCIM), Notifications, Connected accounts, Projects + files + chunks + embeddings, Chats + messages + parts + branches + pins + transcripts + shares, Library + prompts + artifacts, User files + versions + jobs, Models + usage + tools + research, Plans + subscriptions + webhooks + gifts + rollups, API keys + flags + audit + abuse, OAuth platform tables, Memories + assistants + connectors + router + safety, Data export/deletion, Onboarding answers, Blocked emails, Inference gateway requests, Training governance, Operational jobs (artifact/gift/abuse), pgmq chat jobs.

Full narrative: [`reference/database-schema.md`](./reference/database-schema.md).

---

## Part X — Worker endpoint cheat sheet

### chat-history
GET `/v1/chats`, GET `/v1/chats/:id/messages`, POST `/internal/warm`, POST `/internal/invalidate`, GET `/health`

### r2-gateway
PUT/GET object paths per binding; auth Bearer Supabase JWT; GET `/health` if exposed

### chat-coord
POST `/lease|release|stop|status`, GET `/health`

### auth-email
POST `/v1/otp/send|verify|consume-ticket`, POST `/v1/magic/*`, GET `/health`

---

## Part Y — Env group cheat sheet

App public · App server · Supabase · R2 · Workers · Inference Provider_* · Tools · Billing · Redis/JWT · Edge Config · Sandbox optional

Full: [`reference/environment-variables.md`](./reference/environment-variables.md).

---

## Part Z — Closing

If a behavior is not documented here or in the linked system docs, treat `brain/MEMORY.md` and the code paths cited in those docs as authoritative, then update this library. Documentation drift is a product bug for a system this large.

### Quick links

- [Documentation index](./README.md)
- [Architecture overview](./architecture-overview.md)
- [Chat system](./systems/chat-system.md)
- [Frontend](./systems/frontend-architecture.md)
- [Auth](./systems/authentication.md)
- [API reference](./reference/api-reference.md)
- [Database](./reference/database-schema.md)
- [Workers](./systems/cloudflare-workers.md)
- [Ops runbook](./ops/operations-runbook.md)


---

## Appendix AA — Chat message field encyclopedia

Common fields on client message objects (conceptual; see types in frontend lib):

| Field | Description |
|---|---|
| `id` | Durable server id when known |
| `clientId` | Stable client key |
| `role` | `user` \| `assistant` \| `system` \| tool roles |
| `content` | Primary markdown/text |
| `status` | streaming/completed/error/cancelled |
| `content_json` | Structured extras (attachments, agent_ui, tools) |
| `createdAt` | Ordering |
| `branchId` / parent refs | Branch graph |
| `thinking` / reasoning | Hidden or collapsible thinking text |
| `frames` / segments | Agent timeline segments |
| `sources` | Citations |
| `errorText` | Visible failure |

Dedupe identity typically considers clientId, server id, role, and content fingerprints.

---

## Appendix AB — Sidebar Recents filtering rules

1. If messages for a chat are `undefined` (not loaded), **keep** the chat in Recents.
2. If messages are loaded and empty AND chat never started, may hide — but do not confuse with unloaded.
3. Pinned chats listed separately; optimistic pin stays until server agrees.
4. Project-filtered lists pass `projectId` to Worker/API.
5. Search uses `/api/v1/chats/search` when querying.

---

## Appendix AC — Composer attachment pipeline detail

1. User selects files → `composer-attachments.ts` validates type/size.
2. For each file: presign → PUT Worker → complete.
3. File ids collected on the turn payload.
4. Optimistic chips show local previews where possible.
5. On failure: chip error state; send may block or proceed without failed files per UX rules.
6. Edit mode reuses chips inside user bubble card.

---

## Appendix AD — Title generation detail

1. First turn may set `generateChatTitle: true`.
2. Stream path may emit interim title events OR `after()` calls title generator.
3. `normalizeInlineChatTitle` / `finalizeChatTitleStrippedAnswer` / `deriveTitleFromExchange` helpers strip junk.
4. UI updates document title live with hyphen format.
5. Manual rename PATCHes chat; optimistic until list refresh.

---

## Appendix AE — Edge Config flag sketch

Typical flags (consult `readEdgeFlags` implementation for exact keys):

- `maintenanceMode`
- model kill switches
- feature toggles for experimental UI

When maintenanceMode is true, generate returns 503 with stable code for UI messaging.

---

## Appendix AF — Razorpay webhook handling sketch

1. Verify signature with webhook secret.
2. Insert `webhook_events` with provider event id unique constraint.
3. If duplicate → ack 200 without reprocessing.
4. Switch on event type: payment captured, subscription charged, etc.
5. Activate subscription / enqueue gift delivery.
6. Write activation events for audit.

---

## Appendix AG — Onboarding steps sketch

Steps driven by `onboarding-steps.ts` (names/roles/preferences). Each step writes answers; finalization sets completed flag; grandfather migration already completed historical users.

---

## Appendix AH — Workspace SSO/SCIM sketch

1. Verify domain in `workspace_domains`.
2. Configure `sso_connections` with IdP metadata.
3. Issue `scim_tokens` for provisioning.
4. Members sync into `workspace_members` with roles.
5. Enterprise settings may gate features via workspace_settings.

---

## Appendix AI — Research runs sketch

`/api/v1/research/runs` creates longer-running research jobs storing sources in `research_sources` and linking outputs to artifacts/library as implemented.

---

## Appendix AJ — Sandbox lifecycle sketch

1. `POST /api/v1/sandbox` provision (Novita/E2B-compatible).
2. `connect` → session
3. `commands` / `files` / `host` / `metrics`
4. `pause` / `timeout` / delete
5. Agent tools call sandbox session helpers (`sandbox-session.ts`)

Timeouts influenced by `Provider_SANDBOX_TIMEOUT_MS`.

---

## Appendix AK — Customize skills upload sketch

1. UI at `/customize/skills` or settings Skills tab / `#settings/Skills`
2. Upload package → `/api/v1/customize/skills/upload` (60s)
3. Stored in R2 skills bucket + `user_skills` row
4. Agent `read_skill` discovers SKILL.md style content

---

## Appendix AL — Presence broadcast sketch

`chat-presence-broadcast.ts` uses Realtime Broadcast for typing/presence indicators without writing WAL rows. Do not abuse postgres_changes for ephemeral presence.

---

## Appendix AM — Markdown hardening sketch

Assistant markdown passes rehype plugins including harden. Custom protocols blocked. Follow-ups therefore use extracted buttons, not `clauxen-prompt://` links. Math via KaTeX. Code via `code-block` + syntax highlight.

---

## Appendix AN — Font loading sketch

Root layout loads Inter + Playfair. Other chat fonts load on demand when `data-chat-font` changes via `ChatFontLoader`, avoiding boot cost for unused Google fonts.

---

## Appendix AO — Error toast vs inline error

Transient network blips → toast. Terminal generation failure → inline assistant error text (durable). Auth errors → login redirect helpers. Billing errors → checkout error banner.

---

## Appendix AP — Migration authoring checklist

1. Additive preferred
2. Update RLS
3. Add indexes for FK filters (advisor)
4. Revoke dangerous EXECUTE
5. Publish Realtime only if needed
6. Backfill safely
7. Document in `database-schema.md`
8. Note gotcha in MEMORY if operationally surprising

---

## Appendix AQ — Agent event mapping to UI

| Normalized event | UI effect |
|---|---|
| RunStarted | Show orb / frame start |
| Reasoning* | Thinking text + Thought timing |
| ToolCall* | Tool label in frame |
| ToolCallProgress | Partial search progress |
| ToolCallResult | Attach result / sources |
| TextMessage* | Stream answer markdown; hide orb when answer streams |
| StepDone | Step boundary |
| RunFinished | Finalize timings; persist agent_ui |

---

## Appendix AR — Index of docs for searchability

architecture-overview, perf-architecture, perf-metrics, backend, backend-audit, auth-migration, vercel-deployment, vercel-production-setup, systems/chat-system, systems/frontend-architecture, systems/authentication, systems/cloudflare-workers, systems/inference-and-models, systems/billing-and-checkout, systems/projects-and-rag, systems/settings-and-personalization, systems/storage-and-files, systems/autonomous-agent, systems/workspaces-enterprise, systems/routing-and-navigation, systems/realtime-and-caching, systems/onboarding, systems/sharing-and-library, reference/api-reference, reference/database-schema, reference/environment-variables, reference/repository-map, reference/scripts-catalog, reference/ui-component-catalog, guides/development-guide, guides/testing-guide, guides/contributing, ops/security, ops/operations-runbook, ops/cloudflare-zone-hardening, complete-product-deep-dive (this file), research/*.

---

## Appendix AS — Long-form: why chat feels “instant”

Perceived speed is a composition of many small decisions:

The URL changes as soon as a durable chat id exists, so users feel they “have a place” before the model finishes. Optimistic bubbles use stable clientIds so React does not remount when the server assigns ids. The seed race is short enough that a warm path paints content without a route-level loading boundary. Soft navigation avoids tearing down the provider tree. Device cache makes revisits local-first. The history Worker turns Hyperdrive into a miss path. Streaming errors stay visible so users never wonder if the app silently failed. Realtime is disciplined so it cannot fight the stream. Together these create Claude/ChatGPT-like feel without a single silver bullet.

---

## Appendix AT — Long-form: why ops is three clouds

A single-cloud design would be simpler operationally but worse on constraints: Vercel is excellent for Next and streaming but poor for multi-GB uploads and edge list caching at CF’s price point; Supabase is excellent for truth and Realtime but should not serve every binary GET globally; Cloudflare is excellent for edge IO and DO coordination but should not become a second database. The triple-stack is intentional complexity with documented seams.

---

## Appendix AU — Long-form: personalization philosophy

Personalization is modular because shipping a single monolithic prompt per style does not scale. Base style selects a voice; warm/enthusiastic/headers/emoji dials adjust density; custom instructions carry user-specific permanent notes; capabilities gate tools; follow-ups are optional. Removing the duplicate Personality control reduced conflicting instructions. Keeping virgil.md free of hardcoded warmth prevents style settings from fighting the base card.

---

## Appendix AV — Incident timeline template

```
time_utc:
severity:
user_impact:
surfaces:
symptoms:
hypotheses:
checks_run:
mitigation:
follow_up_pr:
docs_updated:
memory_updated:
```

Use this when filing postmortems; store in eng notes, not in MEMORY unless durable gotcha.

---

## Appendix AW — Release checklist

- [ ] Typecheck/lint/test green
- [ ] Docs updated if behavior changed
- [ ] MEMORY decision/gotcha if durable
- [ ] Verified commit
- [ ] Workers redeployed if Worker code changed
- [ ] Env keys present on all three Vercel targets
- [ ] Smoke: login, send, hydrate, upload, stop
- [ ] Watch first production logs for 401/409/5xx

---

## Appendix AX — Cursor agent notes

Agents must read `brain/MEMORY.md` first. Prefer slice implementation. Do not enable paid CF addons unprompted. Do not commit secrets. Update docs when changing durable architecture. This docs library is the human/agent-readable expansion of MEMORY.
