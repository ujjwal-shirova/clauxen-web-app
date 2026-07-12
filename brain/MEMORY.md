# Clauxen Web App — Project Memory

Persistent agent memory. Read this at the start of every task. Update when the user shares durable facts, decisions, preferences, or gotchas.

---

## Meta

- **Path:** `brain/MEMORY.md`
- **Skill:** `.cursor/skills/brain-memory` (invoke for read / write / search)
- **CLI:** `./brain/tools/memory.sh`
- **Always-apply rule:** `.cursor/rules/brain-memory.mdc`
- **Last updated:** 2026-07-12

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
| 2026-07-12 | GitHub auth via SSH Ed25519 | Avoid repeated HTTPS token friction |
| 2026-07-12 | Project memory lives in `brain/MEMORY.md` | Survive context summarization |
| 2026-07-12 | Incremental product build (auth → …) | Avoid boiling the ocean; wire systems one slice at a time |
| 2026-07-12 | Chat messages → Supabase; files/photos → Cloudflare R2 | Split structured data vs blob storage |

---

## Product roadmap (wire-up plan)

Full target surface — **remember only; implement only when user asks for a slice**:

1. **Auth** — Supabase auth sessions, identity cookies, guest vs signed-in
2. **Onboarding** — first-run / profile setup after auth
3. **Billing** — plans / subscription wiring
4. **Settings** — account + product settings
5. **Projects** — project model + UI integration
6. **Chat view** — chat UI wired to persisted messages
7. **Supabase** — store chat messages (+ related structured data) accordingly
8. **Cloudflare R2** — file/photo (and other blob) storage via existing R2/gateway path
9. **Plans** — plan entitlements tied to billing
10. **Customize** — personalization / appearance / preferences
11. **Skills** — skills surface (product feature, not Cursor skills)
12. **Plugins** — plugins surface
13. **Gifts** — gifts feature
14. **Various** — remaining product areas as they come up

**Infra pairing:** Supabase = auth + DB (messages, projects, profiles, plans metadata). Cloudflare R2 = files/photos/blobs. Next.js app on Vercel orchestrates both.

---

## Gotchas

- (none recorded yet)

---

## Open threads

- Execute product roadmap **incrementally** when user picks the next slice (do not start all areas at once).
- Enable **X / Twitter (OAuth 2.0)** in Supabase with Client ID/Secret via Dashboard or `scripts/enable-x-auth.mjs` (app code already uses provider `x`).

---

## User notes

<!-- Append dated bullets the user wants remembered. Keep short. -->

- 2026-07-12: Created `brain/` memory system with always-apply rule + brain-memory skill.
- 2026-07-12: Say remember X and the agent should write it into brain/MEMORY.md
- 2026-07-12: Build auth, billing, onboarding, settings, projects, chat-view; Supabase for messages; Cloudflare R2 for files/photos; also plans, customize, skills, plugins, gifts — **slice-by-slice, not all at once**.
- 2026-07-12: Auth slice — wire **X (Twitter) OAuth 2.0** via Supabase provider `x` (not legacy `twitter`).
- 2026-07-12: X OAuth callback must be https://auth.clauxen.com/auth/v1/callback (Supabase Auth custom domain), website https://www.clauxen.com — never *.supabase.co
- 2026-07-12: X developer portal setup via Playwright (not Cursor browser); login required before app create
