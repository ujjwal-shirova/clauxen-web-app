# Clauxen Web App — Documentation

> Complete technical documentation for the Clauxen AI chat platform.
> Last major rewrite: **2026-07-17**.

Clauxen is a Next.js App Router product deployed on **Vercel**, with durable data in **Supabase Postgres + GoTrue + Realtime**, binary storage and edge caching on **Cloudflare** (R2, Workers, Durable Objects, Hyperdrive, Email Sending), and inference via server-only provider credentials (`Provider_*` env).

Agent Skills for implementation workflows live in [`skills/`](../skills/README.md).

This directory is the source of truth for how the product is built, wired, and operated. Prefer these docs over tribal knowledge; update them when durable architecture decisions change (also mirror decisions into `brain/MEMORY.md`).

---

## How to read this library

| If you need… | Start here |
|---|---|
| Big-picture system map | [`architecture-overview.md`](./architecture-overview.md) |
| Triple-stack ownership (Vercel / CF / Supabase) | [`perf-architecture.md`](./perf-architecture.md) |
| End-to-end chat (send → SSE → persist → hydrate) | [`systems/chat-system.md`](./systems/chat-system.md) |
| Frontend components, hooks, overlays | [`systems/frontend-architecture.md`](./systems/frontend-architecture.md) |
| Every HTTP route | [`reference/api-reference.md`](./reference/api-reference.md) |
| Postgres tables, RPCs, Realtime | [`reference/database-schema.md`](./reference/database-schema.md) |
| Login, OTP, magic link, OAuth, sessions | [`systems/authentication.md`](./systems/authentication.md) |
| Workers (auth-email, chat-history, r2-gateway, chat-coord) | [`systems/cloudflare-workers.md`](./systems/cloudflare-workers.md) |
| Models, tools, system prompts, streaming | [`systems/inference-and-models.md`](./systems/inference-and-models.md) |
| Razorpay, plans, UPI, gifts | [`systems/billing-and-checkout.md`](./systems/billing-and-checkout.md) |
| Projects, RAG, embeddings | [`systems/projects-and-rag.md`](./systems/projects-and-rag.md) |
| Settings tabs, personalization, preferences | [`systems/settings-and-personalization.md`](./systems/settings-and-personalization.md) |
| R2 uploads, attachments, artifacts | [`systems/storage-and-files.md`](./systems/storage-and-files.md) |
| Autonomous tool-use agent | [`systems/autonomous-agent.md`](./systems/autonomous-agent.md) |
| Workspaces, SSO, SCIM | [`systems/workspaces-enterprise.md`](./systems/workspaces-enterprise.md) |
| Routes, soft-nav, hash overlays | [`systems/routing-and-navigation.md`](./systems/routing-and-navigation.md) |
| Local setup | [`guides/development-guide.md`](./guides/development-guide.md) |
| Env var encyclopedia | [`reference/environment-variables.md`](./reference/environment-variables.md) |
| Security model | [`ops/security.md`](./ops/security.md) |
| Deploy / incident runbook | [`ops/operations-runbook.md`](./ops/operations-runbook.md) |
| Vercel env checklist | [`vercel-deployment.md`](./vercel-deployment.md) |
| Auth migration notes | [`auth-migration.md`](./auth-migration.md) |
| Perf metrics targets | [`perf-metrics.md`](./perf-metrics.md) |
| Competitive research | [`research/`](./research/) |
| App health / dead-code / security survey | [`surveys/app-health-security-survey-2026-07-23.md`](./surveys/app-health-security-survey-2026-07-23.md) |
| Chat hydrate / Cloudflare speed architecture | [`surveys/chat-hydrate-perf-architecture-2026-07-23.md`](./surveys/chat-hydrate-perf-architecture-2026-07-23.md) |

---

## Documentation map (all files)

### Core

- [`complete-product-deep-dive.md`](./complete-product-deep-dive.md) — long-form E2E, glossary, decisions, FAQ, appendices
- [`architecture-overview.md`](./architecture-overview.md) — product purpose, layers, data flow, repo layout
- [`perf-architecture.md`](./perf-architecture.md) — who owns which cache/storage concern
- [`perf-metrics.md`](./perf-metrics.md) — Core Web Vitals / RES targets
- [`backend.md`](./backend.md) — short backend bootstrap (legacy summary)
- [`backend-audit.md`](./backend-audit.md) — storage decisions audit (why not D1/Blob/Vectorize)
- [`surveys/app-health-security-survey-2026-07-23.md`](./surveys/app-health-security-survey-2026-07-23.md) — full-app health, dual-stack debt, security, next-direction roadmap
- [`surveys/chat-hydrate-perf-architecture-2026-07-23.md`](./surveys/chat-hydrate-perf-architecture-2026-07-23.md) — IndexedDB vs edge hydrate; Cloudflare/Supabase speed design

### Systems (deep dives)

- [`systems/chat-system.md`](./systems/chat-system.md)
- [`systems/frontend-architecture.md`](./systems/frontend-architecture.md)
- [`systems/authentication.md`](./systems/authentication.md)
- [`systems/cloudflare-workers.md`](./systems/cloudflare-workers.md)
- [`systems/inference-and-models.md`](./systems/inference-and-models.md)
- [`systems/billing-and-checkout.md`](./systems/billing-and-checkout.md)
- [`systems/projects-and-rag.md`](./systems/projects-and-rag.md)
- [`systems/settings-and-personalization.md`](./systems/settings-and-personalization.md)
- [`systems/storage-and-files.md`](./systems/storage-and-files.md)
- [`systems/autonomous-agent.md`](./systems/autonomous-agent.md)
- [`systems/workspaces-enterprise.md`](./systems/workspaces-enterprise.md)
- [`systems/routing-and-navigation.md`](./systems/routing-and-navigation.md)
- [`systems/realtime-and-caching.md`](./systems/realtime-and-caching.md)
- [`systems/onboarding.md`](./systems/onboarding.md)
- [`systems/sharing-and-library.md`](./systems/sharing-and-library.md)

### Reference

- [`reference/api-reference.md`](./reference/api-reference.md)
- [`reference/database-schema.md`](./reference/database-schema.md)
- [`reference/environment-variables.md`](./reference/environment-variables.md)
- [`reference/repository-map.md`](./reference/repository-map.md)
- [`reference/scripts-catalog.md`](./reference/scripts-catalog.md)
- [`reference/ui-component-catalog.md`](./reference/ui-component-catalog.md)
- [`reference/frontend-lib-encyclopedia.md`](./reference/frontend-lib-encyclopedia.md)
- [`reference/gotchas-encyclopedia.md`](./reference/gotchas-encyclopedia.md)

### Guides & ops

- [`guides/development-guide.md`](./guides/development-guide.md)
- [`guides/testing-guide.md`](./guides/testing-guide.md)
- [`guides/contributing.md`](./guides/contributing.md)
- [`ops/security.md`](./ops/security.md)
- [`ops/operations-runbook.md`](./ops/operations-runbook.md)
- [`ops/cloudflare-zone-hardening.md`](./ops/cloudflare-zone-hardening.md)
- [`vercel-deployment.md`](./vercel-deployment.md)
- [`vercel-production-setup.md`](./vercel-production-setup.md)
- [`auth-migration.md`](./auth-migration.md)

---

## Product snapshot

| Item | Value |
|---|---|
| Repo | `ujjwal-shirova/clauxen-web-app` |
| Framework | Next.js 16 App Router, React 19, Tailwind CSS v4 |
| Hosting | Vercel project `clauxen`, region `pdx1` |
| Auth | Supabase GoTrue (`auth.clauxen.com` custom domain) |
| DB | Supabase Postgres + pgvector + pgmq |
| Files | Cloudflare R2 via `clauxen-r2-gateway` |
| Chat hydrate | `clauxen-chat-history` Worker + browser IndexedDB |
| Generation lease | `clauxen-chat-coord` Durable Object |
| Auth email | `clauxen-auth-email` Worker + Email Sending |
| Billing | Razorpay (orders, UPI, subscriptions, webhooks) |
| Inference | Server-only `Provider_API_Key` / `Provider_BASE_URL` / `Provider_Model_Clauxen_V1` |

---

## Canonical conventions (do not violate)

1. **Triple-stack ownership** — do not put the same job on two platforms (see `perf-architecture.md`).
2. **Server-only inference secrets** — never `NEXT_PUBLIC_` for provider keys.
3. **Hash overlays** for settings/pricing/gift/apps — parent page stays mounted (`#settings/Personalization`).
4. **Chat ids are text** (`generateChatId`), not UUID-only — validate with `requireChatIdParam`.
5. **Optimistic UI first** for pin/rename/title; persist async; reconcile with server list.
6. **SSE is source of truth while this tab owns generation** — mute Realtime message noise mid-stream except id remaps.
7. **R2-only binaries in production** — no Vercel Blob / Supabase Storage blobs on the product path.
8. **Verified commits required** on Vercel production — SSH signing key must be on GitHub.

---

## Updating docs

When you change durable behavior:

1. Update the relevant file under `docs/`.
2. Add a dated row to `brain/MEMORY.md` Decisions or Gotchas if it is an operational gotcha.
3. Keep docs factual and path-accurate — cite real modules under `src/`, `workers/`, `supabase/migrations/`.
