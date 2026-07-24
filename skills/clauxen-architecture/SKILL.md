---
name: clauxen-architecture
description: >-
  Clauxen triple-stack architecture (Vercel / Cloudflare / Supabase) ownership, data flow, and non-goals. Use when starting non-trivial work, designing features, choosing where to put cache/storage/compute, or when the user mentions architecture, stack, ownership, or perf boundaries.
---

# Clauxen architecture

## Before you start

1. Read `brain/MEMORY.md` (required).
2. Skim `docs/architecture-overview.md` and `docs/perf-architecture.md` if touching infra or hot paths.

## Ownership (do not duplicate)

| Concern | Owner |
|--------|--------|
| App HTML / React / soft-nav / SSE generate | **Vercel** |
| Static `/_next/static`, `/assets` | Vercel CDN + CF Cache Rules |
| Chat hydrate / list cache | CF `clauxen-chat-history` + browser IndexedDB |
| Generation lease / stop | CF Durable Object `clauxen-chat-coord` |
| Attachments / artifacts bytes | CF R2 + `clauxen-r2-gateway` |
| Feature flags / model kill-switch | Vercel Edge Config |
| Settings / catalog memo | Vercel Runtime Cache |
| Durable rows / RPCs / pgvector / pgmq | **Supabase** |
| Live row sync | Supabase Realtime |
| Auth OTP / magic email | CF `clauxen-auth-email` |

**Never on product path:** Vectorize, Vercel Blob, D1 as SoR, Argo (unless user asks), zone-cached HTML for `/` `/new` `/c/*`.

## Repo map

| Path | Role |
|------|------|
| `src/app/` | Next.js App Router (pages + API routes only) |
| `src/components/` | React UI (incl. chat-view agent transcript under `components/agent/`) |
| `src/hooks/`, `src/contexts/`, `src/stores/` | Client hooks / providers / stores |
| `src/lib/` | Shared + client libs (stream reducers, chat helpers, utils) |
| `src/server/` | Server-only services, repos, inference, auth, billing |
| `src/marketing/` | Marketing site components/content |
| `src/prompts/` | Model system prompts |
| `src/projects/` | Projects / RAG microfrontend libs |
| `workers/` | CF Workers |
| `supabase/migrations/` | Schema |
| `docs/` | Full docs |
| `skills/` | These agent skills |

## Product build style

Implement **one slice** when the user asks. Keep roadmap in MEMORY; do not boil the ocean.

## Additional resources

- [reference.md](reference.md) — hot paths + non-goals
- `docs/complete-product-deep-dive.md`
