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
| 2026-07-14 | CF Free-plan security: 5/5 custom rules (Managed Challenge on app HTML entry, Block scanners/empty-UA/sensitive paths, Challenge suspicious auth POSTs); SSL Full (strict); AI Labyrinth on; Block AI Training crawlers; Browser Integrity Check on; Leaked credential rate rule kept. Under Attack left OFF (custom challenge is targeted). Managed WAF rules need Pro. | User asked for captcha/security on open + advanced hardening; Free plan limits Super Bot Fight / OWASP managed ruleset |
| 2026-07-14 | CF live: Hyperdrive max_age=300/swr=60; chat-history+r2-gateway+auth-email redeployed; zone Cache Rules for /_next/static (1y), /assets (1d), Bypass /api; Rocket Loader off; Early Hints+HTTP/3 on | Playwright dashboard + new Account API token clauxen-workers-deploy |
| 2026-07-14 | Unified login: Continue with Email checks existence → password login or create+OTP via Cloudflare Email Worker | Leonardo-style single entry; remove separate signup surface |
| 2026-07-13 | Performance: RAM message window + inactive chat eviction + LOD + overlay code-split + CF/Vercel cache | Speed Insights FCP/LCP poor on / and /c; cut DOM/RAM and edge latency |
| 2026-07-12 | Use Provider_* Vercel env for inference | Avoid leaking vendor keys via NEXT_PUBLIC or browser DevTools |

| 2026-07-14 | Auth OTP emails via `clauxen-auth-email` Worker (`no-reply@clauxen.com`) | Production signup OTP path uses Cloudflare Email Sending + Vercel `AUTH_EMAIL_*` |
| 2026-07-14 | Magic link signup (new users): 5-min link → `/auth/magic` set-password → onboarding | Label under Continue with Email; existing-user magic login deferred |
| 2026-07-14 | Settings Profile: names/work/custom instructions persist to profiles + user_settings; custom instructions append to chat system prompt under Shirova guidelines | Production ChatGPT/Claude-style personalization |
| 2026-07-14 | Settings Personalization: style/characteristics/fast answers/memory note + Advanced (web search, canvas, connector search; no voice) wired to settings JSONB + capabilities | ChatGPT-parity personalization pane |
| 2026-07-14 | Settings General preferences: theme (light/dark/system via next-themes + `.dark` tokens), Google chat fonts on assistant markdown only, motion + follow-up chips; AppPreferencesProvider applies + persists to Supabase `user_settings.settings.general` | Prefs were saved but never applied to DOM |
| 2026-07-14 | Overlays use ChatGPT-style hashes (`#settings`, `#settings/Personalization`, `#pricing`) on parent pages (`/new`, `/c/…`); legacy `/settings/*` `/upgrade` redirect to `/new#…` | Path overlays blanked the main panel and forced close→`/new` |
| 2026-07-14 | Edge perf: chat-history Worker ladder (Cache API→KV→R2→Hyperdrive) + `/v1/chats` list cache; Supabase revoked anon RPC EXECUTE + FK/list indexes; Vercel CDN/no-store headers | Blazing-fast hydrates; CF/Vercel API tokens currently invalid for live deploy |
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

- Auth email OTP: Worker `https://clauxen-auth-email.ujjwal-8fc.workers.dev`; Vercel needs `AUTH_EMAIL_WORKER_URL` + `AUTH_EMAIL_INTERNAL_TOKEN` (prod/preview/dev). Cloudflare Email Sending onboarded for `clauxen.com` (sender `no-reply@clauxen.com`). Workers KV `expirationTtl` must be ≥ 60s (cooldown was 45 and crashed sends).
- Magic link signup: Worker `/v1/magic/{send,inspect,consume}` (TTL 300s); app routes `/api/v1/auth/magic/*` + `/auth/magic`; new users only for now. Clickable auth labels use `.auth-text-link` (no button hover wash).
- Settings Profile: `fullName`→`profiles.display_name`, nickname→`preferred_name`, occupation+customInstructions in `user_settings.settings.personalization`. Onboarding name/role hydrate settings. Chat injects via `buildUserPersonalizationAppend` into `buildModelSystemPrompt({ append })`.
- Settings General prefs: `AppPreferencesProvider` applies theme/font/motion/follow-ups to `<html>` (`class=dark`, `data-chat-font`, etc.) and persists `settings.general` via PATCH `/api/v1/settings`. Chat fonts style `[data-assistant-content]` only — not app chrome labels.

- Prefer ChatGPT-style hash overlays (`#settings/Personalization`, `#pricing`) on parent paths (`/new`, `/c/…`). Legacy `/settings/*` `/upgrade` `/gift` `/apps` soft-redirect to `/new#…`. Closing an overlay stays on the parent page.
- Canonical boot: `/` soft-replaces to `/new` after identity (hash preserved). Both render ChatView. Overlay surfaces are hashes, not Next routes.
- Overlay open must be instant: `AppOverlaysProvider` uses `history.pushState` on `pathname#hash` (not path replacement). Host via `AppOverlayHost` + `FullscreenPortal` to `document.body` because `.agent-panel` uses `transform: translateZ(0)` which traps `position: fixed`.
- Main surfaces (library/projects/customize/chats) use `useInstantNavigate` (pushState + soft Next sync; hash restored after soft nav).
- Home `/` soft-replaces to `/new` after auth (hash preserved); isNewChatPath still treats `/` and `/new` as blank chat.
- Checkout UPI is INR-only; geo USD can wrongly hide it — prefer browser India heuristic; use local UPI/card SVG icons (no Stripe/logo CDNs).
- `chats.id` is `text` (custom long ids + legacy UUID strings). Validate with `requireChatIdParam`.
- Recents filter: never treat “messages not hydrated yet” as empty — `filterStartedRecentChats` keeps chats when local messages are `undefined` (reload bug that hid all chats).
- Inference: server uses `Provider_API_Key` + `Provider_BASE_URL` (+ `Provider_Model_Clauxen_V1`); Exa uses `EXA_API_KEY`. No hardcoded provider base URL/keys. Fail closed via `requireProviderApiKey` / `requireProviderBaseUrl` / `requireExaApiKey`.
- Sidebar Recents shimmer on first chat list fetch; conversation pane shimmer while `/c/[id]` messages hydrate. Realtime chat list refresh is silent (no full-list re-shimmer).
- Chat transcripts for training: `chat_transcript_lines` stores Cursor-style JSONL records (`role` + `message.content` parts including `text` / `thinking` / `tool_use` / `tool_result`, plus `turn_ended`). View `chat_transcripts_jsonl` aggregates one JSONL doc per chat. Export: `GET /api/v1/chats/[chatId]/transcript`.
- Branch PUT must use `sanitizeBranchMessages` (keeps ids/frames). Never `sanitizeMessages` for branch state — that stripped ids and caused reload duplicate assistants.
- Chat-history Worker: Cache API → KV → R2 → Hyperdrive; also caches sidebar `GET /v1/chats` + JWT memo. Redeploy via `./scripts/ops/apply-cloudflare-perf-stack.sh` when `CLOUDFLARE_API_TOKEN` is valid. Tune Hyperdrive `--max-age 300 --swr 60`.
- Local `CLOUDFLARE_API_TOKEN` / Vercel CLI tokens were invalid (9109 / login) as of 2026-07-14 — cannot deploy Workers or change Hyperdrive from this machine until tokens are refreshed.
- Supabase: anon/authenticated EXECUTE revoked on chat SECURITY DEFINER RPCs; service_role/postgres only. Enable Auth leaked-password protection in dashboard.
- Attachment Worker PUTs require `Authorization: Bearer <supabase access token>` when `worker: true` on presign.

---

- ChatSessionProvider is API-only (useChatApi) so local IndexedDB path stays out of main bundle; project/local still use useChat
- Streamdown CSS loads idle via StreamdownStyles — do not re-import streamdown/styles.css in (main)/layout
- Signup OTP: AUTH_EMAIL_WORKER_URL + AUTH_EMAIL_INTERNAL_TOKEN; deploy workers/auth-email; onboard Email Sending domain; AUTH_DEV_BYPASS can simulate OTP locally
- Cursor Cloud: this agent run has environment=null — secrets Cloudflare_Token/Vercel_Token/Supabase_Token only inject when the agent is started FROM a Cursor Environment that lists them. Adding secrets mid-run or in a different Environment does not populate this pod.
- New-chat send: keep showing chat-view once messages/activeChatId exist (don’t blank while still on `/new`); sidebar shows shimmer until chat id + first message land; tab is brand-only (`Clauxen`) until a real title exists.
- Account API token can deploy Workers/Hyperdrive but not Zone settings/Cache Rules API (403) — use dashboard or User API token with Zone Cache Rules Edit
- CF dash cookie consent overlay blocks clicks; dismiss Allow All before Deploy on Cache Rules
- cf.threat_score is deprecated on upgraded CF security — do not use in custom rules. Free plan: 5 custom rules, 1 rate-limit rule.
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

- 2026-07-14: `clauxen-auth-email` live; Email Sending enabled on clauxen.com; Vercel AUTH_EMAIL_* wired; OTP signup E2E verified (delivered from no-reply@clauxen.com → confirmed Supabase user + password sign-in).
