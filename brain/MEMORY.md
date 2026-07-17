# Clauxen Web App — Project Memory

Persistent agent memory. Read this at the start of every task. Update when the user shares durable facts, decisions, preferences, or gotchas.

---

## Meta

- **Path:** `brain/MEMORY.md`
- **Skill:** `.cursor/skills/brain-memory` (invoke for read / write / search)
- **CLI:** `./brain/tools/memory.sh`
- **Always-apply rule:** `.cursor/rules/brain-memory.mdc`
- **Last updated:** 2026-07-14

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
| 2026-07-17 | Vercel env: production+preview=sensitive, development=encrypted; all keys on all three targets | Vercel API forbids sensitive on Development; reconcile-vercel-env.mjs enforces the allowed shape |
| 2026-07-17 | Terminal SSE errors must propagate to the UI; incomplete or empty streams persist visible failure text | The SSE parser caught consumer errors, turning provider failures into blank completed assistant messages |
| 2026-07-17 | While this tab owns SSE generation, mute Supabase chat_messages realtime except id remaps | ChatGPT/Claude pattern: stream is UI source of truth; empty WAL updates were clearing the orb mid-turn |
| 2026-07-17 | Live streaming assistant always wins over empty cold server/IDB snapshots in dedupe+hydrate | Empty completed rows were preferred by score and killed the orb on new-chat/follow-up |
| 2026-07-17 | Signed-in chats use per-user IndexedDB device cache (list + 40 bodies) with silent Worker reconcile | Cut latency and origin load at scale without polling; server remains truth |
| 2026-07-17 | Skip Argo and any CF/Vercel billing/addons unless user asks | Free zone speed settings (HTTP/3, Early Hints, Tiered Cache, Cache Rules) are enough; Argo is optional paid |
| 2026-07-17 | Triple-stack ownership: Vercel=stream+Edge Config+Runtime Cache; CF=history Worker+R2+DO lease+zone; Supabase=truth+Realtime+pgvector+pgmq | Avoid duplicate caches/storage; R2-only files; no Vectorize/Blob on product path |
| 2026-07-16 | Sidebar chat selection highlight only on row container | button[aria-current=page] global CSS nested a second pill inside the selected row |
| 2026-07-16 | No loading.tsx on /new or /c/[chatId]; seed race ≤120ms | loading.tsx + long SSR seed wait caused post-create shimmer; soft-nav must keep optimistic chat-view |
| 2026-07-14 | CF Free-plan security: 5/5 custom rules (Managed Challenge on app HTML entry, Block scanners/empty-UA/sensitive paths, Challenge suspicious auth POSTs); SSL Full (strict); AI Labyrinth on; Block AI Training crawlers; Browser Integrity Check on; Leaked credential rate rule kept. Under Attack left OFF (custom challenge is targeted). Managed WAF rules need Pro. | User asked for captcha/security on open + advanced hardening; Free plan limits Super Bot Fight / OWASP managed ruleset |
| 2026-07-14 | CF live: Hyperdrive max_age=300/swr=60; chat-history+r2-gateway+auth-email redeployed; zone Cache Rules for /_next/static (1y), /assets (1d), Bypass /api; Rocket Loader off; Early Hints+HTTP/3 on | Playwright dashboard + new Account API token clauxen-workers-deploy |
| 2026-07-14 | Unified login: Continue with Email checks existence → password login or create+OTP via Cloudflare Email Worker | Leonardo-style single entry; remove separate signup surface |
| 2026-07-13 | Performance: RAM message window + inactive chat eviction + LOD + overlay code-split + CF/Vercel cache | Speed Insights FCP/LCP poor on / and /c; cut DOM/RAM and edge latency |
| 2026-07-12 | Use Provider_* Vercel env for inference | Avoid leaking vendor keys via NEXT_PUBLIC or browser DevTools |

| 2026-07-14 | Auth OTP emails via `clauxen-auth-email` Worker (`no-reply@clauxen.com`) | Production signup OTP path uses Cloudflare Email Sending + Vercel `AUTH_EMAIL_*` |
| 2026-07-14 | Magic link signup (new users): 5-min link → `/auth/magic` set-password → onboarding | Label under Continue with Email; existing-user magic login deferred |
| 2026-07-14 | Settings Profile: names/work/custom instructions persist to profiles + user_settings; custom instructions append to chat system prompt under Shirova guidelines | Production ChatGPT/Claude-style personalization |
| 2026-07-14 | Settings Personalization: style/characteristics/fast answers/memory note + Advanced (web search, canvas, connector search; no voice) wired to settings JSONB + capabilities | ChatGPT-parity personalization pane |
| 2026-07-15 | Personalization: modular `.md` style instructions; Personality UI removed (duplicate of base style); virgil.md no longer hardcodes warm/emoji/list personality | Settings-driven style swaps alongside main system prompt |
| 2026-07-14 | Settings General preferences: theme (light/dark/system via next-themes + `.dark` tokens), Google chat fonts on assistant markdown only, motion + follow-up chips; AppPreferencesProvider applies + persists to Supabase `user_settings.settings.general` | Prefs were saved but never applied to DOM |
| 2026-07-14 | Overlays use ChatGPT-style hashes (`#settings`, `#settings/Personalization`, `#pricing`) on parent pages (`/new`, `/c/…`); legacy `/settings/*` `/upgrade` redirect to `/new#…` | Path overlays blanked the main panel and forced close→`/new` |
| 2026-07-15 | Vercel Require Verified Commits is ON — GitHub must show commit as Verified (SSH signing key uploaded separately from auth key) | Deployments of unverified commits are auto-canceled |
| 2026-07-15 | Notifications: Push/Email popover with row-click toggles; settings persist optimistic (no PATCH response overwrite) | Fix 2–4s toggle flicker |
| 2026-07-17 | New-chat → `/c/{id}`: navigate the instant durable chat id exists (`onChatCreated` + `useInstantNavigate`); do not await message persist before URL swap. `handleSelectChat` never lets sparse SSR seed wipe optimistic/live turns. | ChatGPT/Claude open-chat feel; blank/flicker on send from `/new` |
| 2026-07-17 | Agentic frame: live `Label · duration` while streaming; thinking-only collapses to `Thought for Ns`; tools keep `Worked for …`. Persist `agent_ui` timing on `content_json` for reload. | Match ChatGPT/Claude thought chips + durable Worked-for |
| 2026-07-17 | Follow-ups: extract `<prompt>` tags into dedicated buttons (never markdown `clauxen-prompt://` links — rehype-harden shows `[blocked]`). Single agent activity frame per turn (no stacked Brewed/Churned). Provider Anthropic URL derived from `Provider_BASE_URL` (`/openai`→`/anthropic`). Message dedupe for optimistic+realtime. Conversation context includes prior tool actions for follow-ups. | User screenshots: [blocked] prompts, duplicate user bubbles, multi-frame activity, weak follow-up context |
| 2026-07-16 | RAM eviction omits messageIds keys (not `[]`) so Recents filter does not hide switched-away chats | Bug: new chat vanished after opening another chat |
| 2026-07-15 | Personalization style/characteristics use modular `.md` instructions (base style + warm/enthusiastic/headers/emoji More|Default|Less); Personality row removed as duplicate of base style; virgil.md no longer hardcodes warm/emoji/list personality | ChatGPT-parity settings; style swaps without editing main system card |
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
- Sidebar Recents shimmer on first chat list fetch; `/c/[id]` prefers SSR seed (no message shimmer when seed hits) else client hydrate shimmer. Realtime chat list refresh is silent (no full-list re-shimmer).
- Chat fonts: only Inter + Playfair in root layout; other Google chat fonts load on demand via `ChatFontLoader` when `data-chat-font` is set.
- Auth boot uses `GET /api/v1/auth/session?quiet=1` (local JWT/hint, no profile sync); full session sync runs in background after FCP.
- Edge `proxy.ts` skips `updateSession` for `/api/*` (handlers auth themselves) to cut stacked TTFB on `/c` cold loads.
- Chat history: full-thread hydrate (Worker-first `listAllChatMessages`, limit 500). No scroll-up pagination UI. Rare longer threads silently page before paint. SSR seed same path with `hasMore: false`.
- Vercel Require Verified Commits: HEAD must be GitHub-Verified. Global git is configured for SSH signing (`gpg.format=ssh`, `user.signingkey=~/.ssh/id_ed25519.pub`, `commit.gpgsign=true`). Same Ed25519 pubkey is on GitHub as both **Authentication** (`ujjwal mac ssh key`) and **Signing** (`ujjwal mac signing key`). Auth key alone is not enough for Verified. `gh` re-authed 2026-07-15 as `ujjwal-shirova` with `admin:ssh_signing_key` scope.
- User message edit: inline in the bubble (`UserMessageInlineEditor`) — no expand dialog. Attachments render inside the card; edit grows chips + bottom plus/mic/send (no model selector). Clear-all cancels. Send creates a branch via `editMessageWithBranch`. Sticky edit host uses same pin/unpin path as collapsed (`preventScroll` focus + blur on user viewport scroll so focus cannot trap sticky). Click main `[data-component="agent-panel"]` (not sidebar) collapses edit.
- Send flicker fix (2026-07-15): messages carry stable `clientId` for React keys / streamKey / enter animation; `handleSelectChat` skips SSR seed when chat is live or already hydrated. DB id swaps must not remount turns.
- Follow-ups: model emits `<prompt>…</prompt>` in markdown (any list/prose); UI renders clickable → dotted links that send on click. System instruction injected only when Settings → Follow-up suggestions is ON (`loadFollowUpSuggestionsEnabled` + `buildFollowUpSystemInstruction`). Toggle off strips tags to plain text and omits the instruction.
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
- CF Managed Challenge can POST back to document URLs → Vercel 405. Fixed in src/proxy.ts with 303 POST→GET (keeps /api and next-action). Do not weaken CF rules for this.
- Realtime remapping assistant id mid-stream must update generation map; appendMessageField must resolve by clientId or tokens write to a deleted id (blank orb)
- Production uploads require WORKER_URL; Hyperdrive chat-history stays caching-disabled; Vercel region pdx1 near Supabase us-west-1
- Vercel CLI auth.json token invalid; dashboard login needs 2FA — wire CHAT_COORD_*/WORKER_URL/EDGE_CONFIG with fresh VERCEL_TOKEN or 2FA handoff. CF API token lacks zone edit (9109).
- Vercel sensitive env vars cannot target Development — use a second encrypted row for development with the same value
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

- 2026-07-14: Chat hydrate is full-thread (no scroll-up pagination). Limit 500 via Worker; silent multi-page only for rare mega-threads.
- 2026-07-14: `clauxen-auth-email` live; Email Sending enabled on clauxen.com; Vercel AUTH_EMAIL_* wired; OTP signup E2E verified (delivered from no-reply@clauxen.com → confirmed Supabase user + password sign-in).
- 2026-07-17: 2026-07-17: Reconciled 52 Vercel env keys to sensitive(prod+preview)+encrypted(dev). Rotated AUTH_EMAIL_INTERNAL_TOKEN on CF Worker + Vercel. Blank dashboard fill-ins remain for POSTGRES_* and some SUPABASE secrets — fill in Vercel if production needs them.
