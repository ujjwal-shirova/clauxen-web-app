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

- After meaningful code changes: commit and push (exclude secrets, Playwright dumps, `__pycache__`).
- Prefer HTTPS push if SSH fails (SSH is now set up and working).
- Cloudflare MCP: use Cursor **plugin** Cloudflare MCPs (not duplicate entries in `~/.cursor/mcp.json`).

---

## Decisions

| Date | Decision | Why |
|------|----------|-----|
| 2026-07-12 | GitHub auth via SSH Ed25519 | Avoid repeated HTTPS token friction |
| 2026-07-12 | Project memory lives in `brain/MEMORY.md` | Survive context summarization |

---

## Gotchas

- (none recorded yet)

---

## Open threads

- (none recorded yet)

---

## User notes

<!-- Append dated bullets the user wants remembered. Keep short. -->

- 2026-07-12: Created `brain/` memory system with always-apply rule + brain-memory skill.
- 2026-07-12: Say remember X and the agent should write it into brain/MEMORY.md
