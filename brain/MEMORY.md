# Clauxen Web App — Project Memory

Persistent agent memory. Read this at the start of every task. Update when the user shares durable facts, decisions, preferences, or gotchas.

---

## Meta

- **Path:** `brain/MEMORY.md`
- **Skill:** `.cursor/skills/brain-memory` (invoke for read / write / search)
- **CLI:** `./brain/tools/memory.sh`
- **Always-apply rule:** `.cursor/rules/brain-memory.mdc`
- **Last updated:** 2026-07-13

---

## Project snapshot

- **Repo:** `ujjwal-shirova/clauxen-web-app`
- **Git remote:** SSH `git@github.com:ujjwal-shirova/clauxen-web-app.git`
- **Vercel team:** `shirova-ai` (`team_uO4zWwgLWJfc9GpMMrr5KOwa`)
- **Vercel project:** `clauxen` (`prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr`)
- **Stack notes:** Next.js web app; Cloudflare Workers/R2 used in parts of the stack; Supabase for auth/data

---

## Preferences / agent behavior

- After meaningful code changes: commit and push (exclude secrets, Playwright dumps, `__pycache__`) — **unless the user says not to**.
- Prefer HTTPS push if SSH fails (SSH is now set up and working).
- Cloudflare MCP: use Cursor **plugin** Cloudflare MCPs (not duplicate entries in `~/.cursor/mcp.json`).
- **Build style for product work:** do **not** implement everything at once. Work in focused slices when the user starts a piece; keep the full roadmap in this file.

---

## Decisions

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-14 | Unified login: Continue with Email checks existence → password login or create+OTP via Cloudflare Email Worker | Leonardo-style single entry; remove separate signup surface |
| 2026-07-13 | Performance: RAM message window + inactive chat eviction + LOD + overlay code-split + CF/Vercel cache | Speed Insights FCP/LCP poor on / and /c; cut DOM/RAM and edge latency |
| 2026-07-12 | Use Provider_* Vercel env for inference | Avoid leaking vendor keys via NEXT_PUBLIC or browser DevTools |
| 2026-07-12 | GitHub auth via SSH Ed25519 | Avoid repeated HTTPS token friction |
| 2026-07-12 | Project memory lives in `brain/MEMORY.md` | Survive context summarization |
| 2026-07-12 | Incremental product build (auth → …) | Avoid boiling the ocean; wire systems one slice at a time |
| 2026-07-12 | Chat ids use long-form text IDs (`generateChatId`) verified unique in DB | Shareable ChatGPT-style `/c/...` URLs |
| 2026-07-12 | Browser tab titles use hyphen (`New chat - Clauxen`) and update live | Match product UX; middle-dot was hard to read |
| 2026-07-13 | Streaming orb stays visible during agent timelines; hides only when answer markdown is streaming | Claude/Cursor vertical-timescale UX |
| 2026-07-13 | Chat attachments: images + text docs + PDF chips via R2/`user_files`/`chat_message_parts` | ChatGPT/Claude composer parity |
| 2026-07-13 | Chat-history Worker cache ladder (Cache API → KV → R2 → Hyperdrive); latest TTL 900s / cursor 300s + SWR; invalidate on delete | Reduce Supabase/Hyperdrive load; faster /c hydrates |
| 2026-07-13 | R2 buckets `clauxen-images/documents/artifacts/skills` created; deploy `clauxen-r2-gateway` + set `WORKER_URL` still required | Uploads off Vercel body limit |

---

## Product roadmap (wire-up plan)

Full target surface — **remember only; implement only when user asks for a slice**:

1. **Auth** — Supabase auth sessions, identity cookies, guest vs signed-in
2. **Onboarding** — first-run / profile setup after auth
3. **Billing** — plans / subscription wiring
4. **Settings** — account + product settings
5. **Projects** — project model + UI integration
6. **Chat view** — ✅ core + attachments + agent timeline orb + edge cache (2026-07-13); MCP connectors still deferred
7. **Supabase** — store chat messages (+ related structured data) accordingly — ✅ messages + parts + transcript JSONL
8. **Cloudflare R2** — buckets created; **r2-gateway Worker deploy + WORKER_URL** still ops follow-up
9. **Plans** — plan entitlements tied to billing
10. **Customize** — personalization / appearance / preferences
11. **Skills** — skills surface (product feature, not Cursor skills)
12. **Plugins** — plugins surface
13. **Gifts** — gifts feature
14. **Various** — remaining product areas as they come up

**Infra pairing:** Supabase = auth + DB (messages, projects, profiles, plans metadata). Cloudflare R2 = files/photos/blobs. Next.js app on Vercel orchestrates both.

---

## Gotchas

- Prefer path routes (`/upgrade`, `/settings/general`) over hash overlays (`#pricing`) — hash + Next soft-nav caused hydration mismatches.
- Canonical new-chat URLs are `/` and `/new` (both render ChatView; no redirect hop). Overlay surfaces live as real routes under `(main)`.
- Overlay open must be instant: `AppOverlaysProvider` uses `history.pushState` + local state (not blocking `router.push`). Host via `AppOverlayHost` + `FullscreenPortal` to `document.body` because `.agent-panel` uses `transform: translateZ(0)` which traps `position: fixed`.
- Main surfaces (library/projects/customize/chats) use `useInstantNavigate` (pushState + soft Next sync).
- New-chat send: keep showing chat-view once messages/activeChatId exist (don’t blank while still on `/new`); sidebar shows shimmer until chat id + first message land; tab is brand-only (`Clauxen`) until a real title exists.
- Checkout UPI is INR-only; geo USD can wrongly hide it — prefer browser India heuristic; use local UPI/card SVG icons (no Stripe/logo CDNs).
- `chats.id` is `text` (custom long ids + legacy UUID strings). Validate with `requireChatIdParam`.
- Recents filter: never treat “messages not hydrated yet” as empty — `filterStartedRecentChats` keeps chats when local messages are `undefined` (reload bug that hid all chats).
- Inference: server uses `Provider_API_Key` + `Provider_BASE_URL` (+ `Provider_Model_Clauxen_V1`); Exa uses `EXA_API_KEY`. No hardcoded provider base URL/keys. Fail closed via `requireProviderApiKey` / `requireProviderBaseUrl` / `requireExaApiKey`.
- Sidebar Recents shimmer on first chat list fetch; conversation pane shimmer while `/c/[id]` messages hydrate. Realtime chat list refresh is silent (no full-list re-shimmer).
- Chat transcripts for training: `chat_transcript_lines` stores Cursor-style JSONL records (`role` + `message.content` parts including `text` / `thinking` / `tool_use` / `tool_result`, plus `turn_ended`). View `chat_transcripts_jsonl` aggregates one JSONL doc per chat. Export: `GET /api/v1/chats/[chatId]/transcript`.
- Branch PUT must use `sanitizeBranchMessages` (keeps ids/frames). Never `sanitizeMessages` for branch state — that stripped ids and caused reload duplicate assistants.
- Chat-history Worker already emits `x-clauxen-cache`; redeploy worker after TTL/invalidate changes (`cd workers/chat-history && npx wrangler deploy`).
- Attachment Worker PUTs require `Authorization: Bearer <supabase access token>` when `worker: true` on presign.

---

- ChatSessionProvider is API-only (useChatApi) so local IndexedDB path stays out of main bundle; project/local still use useChat
- Streamdown CSS loads idle via StreamdownStyles — do not re-import streamdown/styles.css in (main)/layout
- Home `/` now renders ChatView directly (no redirect hop to /new) for FCP; isNewChatPath still treats / and /new as blank chat
- Signup OTP: AUTH_EMAIL_WORKER_URL + AUTH_EMAIL_INTERNAL_TOKEN; deploy workers/auth-email; onboard Email Sending domain; AUTH_DEV_BYPASS can simulate OTP locally
- Cursor Cloud: this agent run has environment=null — secrets Cloudflare_Token/Vercel_Token/Supabase_Token only inject when the agent is started FROM a Cursor Environment that lists them. Adding secrets mid-run or in a different Environment does not populate this pod.
## Open threads

- Execute product roadmap **incrementally** when user picks the next slice (do not start all areas at once).
- Enable **X / Twitter (OAuth 2.0)** in Supabase with Client ID/Secret via Dashboard or `scripts/enable-x-auth.mjs` (app code already uses provider `x`).
- Local-only (do not commit until asked): login OAuth button set (no Apple/X).

---

- Deploy clauxen-auth-email Worker + set Vercel AUTH_EMAIL_* env + onboard Email Sending domain for noreply@clauxen.com
- Deploy clauxen-auth-email (FROM no-reply@clauxen.com) + wire Vercel AUTH_EMAIL_WORKER_URL/AUTH_EMAIL_INTERNAL_TOKEN + onboard Cloudflare Email Sending for clauxen.com — requires Cloudflare_Token + Vercel_Token in an Environment-backed agent (or GH Actions secrets).
## User notes

<!-- Append dated bullets the user wants remembered. Keep short. -->

- 2026-07-12: Created `brain/` memory system with always-apply rule + brain-memory skill.
- 2026-07-12: Say remember X and the agent should write it into brain/MEMORY.md
- 2026-07-12: Build auth, billing, onboarding, settings, projects, chat-view; Supabase for messages; Cloudflare R2 for files/photos; also plans, customize, skills, plugins, gifts — **slice-by-slice, not all at once**.
- 2026-07-12: Auth slice — wire **X (Twitter) OAuth 2.0** via Supabase provider `x` (not legacy `twitter`).
- 2026-07-12: X OAuth callback must be https://auth.clauxen.com/auth/v1/callback (Supabase Auth custom domain), website https://www.clauxen.com — never *.supabase.co
- 2026-07-12: X developer portal setup via Playwright (not Cursor browser); login required before app create
- 2026-07-12: Login OAuth buttons: Google, GitHub, GitLab only — Apple and X/Twitter removed from login UI (do not commit this preference change unless asked)
- 2026-07-12: Inference env renamed to Provider_API_Key, Provider_BASE_URL, Provider_SANDBOX_TIMEOUT_MS, Provider_Model_Clauxen_V1 (server-only Sensitive). Chat uses Provider_Model_Clauxen_V1. Do not commit until asked.
- 2026-07-12: App surfaces use shareable paths: `/new`, `/upgrade`, `/gift`, `/apps`, `/settings/[tab]`; legacy `#pricing` / `#settings/...` hashes redirect to paths.
- 2026-07-13: 2026-07-13: Perf push — target RES >90 via RAM window 24/48, LOD height-lock, CF SWR TTLs 900/300, Vercel function memory 512 default
- 2026-07-14: 2026-07-14: Login unified — no separate signup page; /signup redirects to /login; Cloudflare clauxen-auth-email Worker + KV clauxen-auth-otp
