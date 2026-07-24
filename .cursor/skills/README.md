# Clauxen Agent Skills

Project Agent Skills for Cursor. Canonical location: **`skills/`** at the repo root.

Each skill is a folder with `SKILL.md` (required) plus optional `reference.md` / `examples.md`.

These skills encode Clauxen-specific workflows, hard rules, and pointers into `docs/` and `brain/MEMORY.md`. They complement (do not replace) always-on brain memory.

## Discovery

- Canonical: `skills/<name>/SKILL.md`
- Cursor project skills: symlinked into `.cursor/skills/<name>` (same content)
- Always-on memory: `.cursor/skills/brain-memory` + `.cursor/rules/brain-memory.mdc`
- Always-apply rule: `.cursor/rules/clauxen-skills.mdc` (read matching skill before domain work)

When starting domain work, **read the matching skill** before editing.

## Skill catalog (24)

| Skill | When to use |
|-------|-------------|
| `clauxen-api` | Clauxen HTTP API surface: /api/v1 routes, auth requirements, SSE generate, legacy /api/chat and /api/projects. Use when adding or changing route handlers, API contracts, or clx_… |
| `clauxen-architecture` | Clauxen triple-stack architecture (Vercel / Cloudflare / Supabase) ownership, data flow, and non-goals. Use when starting non-trivial work, designing features, choosing where to… |
| `clauxen-auth` | Clauxen authentication: Supabase GoTrue, unified login, OTP/magic via auth-email Worker, OAuth (including X provider x), sessions, proxy/middleware, onboarding gate. Use when wo… |
| `clauxen-autonomous-agent` | Clauxen chat agent loop via `@/server/agent-core` (Provider Messages, SSE, DOM transcript). Use when editing query-loop, tools, or `src/components/agent/*`. |
| `clauxen-billing` | Clauxen billing and checkout: Razorpay orders, UPI INR, subscriptions, webhooks, gifts, plans catalog. Use when working on pricing overlay, checkout pages, Razorpay, UPI QR, inv… |
| `clauxen-chat` | Clauxen chat system: send, SSE streaming, hydrate, dedupe, device cache, branches, follow-ups, agent orb/frames, leases, stop. Use when working on chat UI, use-chat-api, generat… |
| `clauxen-cloudflare-workers` | Clauxen Cloudflare Workers: chat-history, r2-gateway, chat-coord Durable Object, auth-email, zone cache/WAF. Use when deploying Workers, tuning Hyperdrive/KV/Cache API, fixing h… |
| `clauxen-database` | Clauxen Supabase Postgres: migrations, RLS, chat RPCs, Realtime publications, pgvector, pgmq. Use when writing SQL migrations, changing schema, RLS policies, SECURITY DEFINER RP… |
| `clauxen-debug-chat` | Debug Clauxen chat failures: blank assistants, dead orb, hydrate flicker, duplicate messages, 409 lease, upload failures, follow-up [blocked], Recents vanishing. Use when the us… |
| `clauxen-deploy-ops` | Clauxen deploy and operations: Vercel verified commits, env reconcile (sensitive/encrypted), Worker deploys, incident runbook, region pdx1. Use when deploying, rotating secrets,… |
| `clauxen-docs` | Clauxen documentation library under docs/: when and how to update system docs, deep dive, gotchas, and README index. Use when writing or updating docs, after architecture change… |
| `clauxen-env` | Clauxen environment variables and secrets: .env.example groups, Vercel sensitive vs encrypted, reconcile script, Provider_* naming, Worker URLs/tokens. Use when adding env vars,… |
| `clauxen-frontend` | Clauxen frontend: ChatView, overlays, soft-nav, preferences, sidebar UX, providers, Tailwind/shadcn patterns. Use when editing React under `src/components` or `src/hooks`, hash overlays… |
| `clauxen-inference` | Clauxen inference: Provider_* env, system prompts, personalization modules, tools (Exa/sandbox), SSE framing, autonomous agent bridge, Shirova Messages API. Use when changing mo… |
| `clauxen-onboarding` | Clauxen first-run onboarding: /onboarding steps, answers persistence, profile hydrate into settings. Use when editing onboarding UI, onboarding API, or post-auth redirects for n… |
| `clauxen-product-slice` | Clauxen incremental product build workflow: pick one roadmap slice, implement end-to-end, update docs/MEMORY, avoid boiling the ocean. Use when the user starts a new feature are… |
| `clauxen-projects-rag` | Clauxen projects and RAG: project folders, file ingestion, chunking, pgvector retrieval, project chats. Use when working on /projects, project files, embeddings, BullMQ worker i… |
| `clauxen-realtime-cache` | Clauxen realtime and caching: device IndexedDB, chat-history Worker ladder, Realtime mute rules, invalidate/warm, static CDN headers. Use when changing hydrate caching, Realtime… |
| `clauxen-security` | Clauxen security: secrets handling, RLS, CF WAF rules, proxy challenge fix, API keys, webhook verification. Use when doing security review, adding authz, rotating tokens, CF cus… |
| `clauxen-settings` | Clauxen settings and personalization: hash overlays, settings tabs, AppPreferences, modular style .md, notifications optimistic toggles, profile fields. Use when editing setting… |
| `clauxen-sharing` | Clauxen chat sharing and library: share tokens, public /share/[token], library items, artifacts viewer. Use when working on share dialog, conversation_shares, library route, or … |
| `clauxen-storage` | Clauxen file storage: R2 buckets, presign/complete, r2-gateway uploads, chat attachments, artifacts, quotas. Use when working on uploads, attachments, user_files, WORKER_URL, R2… |
| `clauxen-testing` | Clauxen testing: npm test (tsx), high-value frontend lib tests, typecheck/lint, manual E2E chat checklist. Use when adding tests, fixing regressions, or verifying chat/auth/bill… |
| `clauxen-workspaces` | Clauxen workspaces and enterprise: members, domains, SSO, SCIM, workspace settings. Use when working on team accounts, /api/v1/workspaces/*, SSO connections, or SCIM tokens. |

## Suggested routing

| Task | Skill |
|------|-------|
| Where does X belong? | `clauxen-architecture` |
| Chat / stream / orb | `clauxen-chat` or `clauxen-debug-chat` |
| Login / OTP / OAuth | `clauxen-auth` |
| UI / overlays / soft-nav | `clauxen-frontend` |
| Workers / R2 / leases | `clauxen-cloudflare-workers` |
| Models / prompts / tools | `clauxen-inference` |
| Razorpay / UPI | `clauxen-billing` |
| Projects / embeddings | `clauxen-projects-rag` |
| Settings / personalization | `clauxen-settings` |
| Uploads / attachments | `clauxen-storage` |
| Migrations / RLS | `clauxen-database` |
| Deploy / env / incidents | `clauxen-deploy-ops` or `clauxen-env` |
| Security review | `clauxen-security` |
| New feature slice | `clauxen-product-slice` |
| Update docs | `clauxen-docs` |
| API routes | `clauxen-api` |
| Cache / Realtime | `clauxen-realtime-cache` |
| Autonomous agent | `clauxen-autonomous-agent` |
| Workspaces / SSO | `clauxen-workspaces` |
| Onboarding | `clauxen-onboarding` |
| Share / library | `clauxen-sharing` |
| Tests | `clauxen-testing` |

## Authoring new skills

1. Create `skills/<kebab-name>/SKILL.md` with YAML `name` + `description` (WHAT + WHEN, third person).
2. Keep `SKILL.md` under ~500 lines; put detail in `reference.md`.
3. Symlink for Cursor discovery:
   ```bash
   ln -sfn ../../skills/<name> .cursor/skills/<name>
   ```
4. Update this README catalog.

## Related

- [`docs/README.md`](../docs/README.md) — full documentation library
- [`brain/MEMORY.md`](../brain/MEMORY.md) — durable decisions/gotchas
- `.agents/skills/supabase*` — upstream Supabase skills (separate from this catalog)
