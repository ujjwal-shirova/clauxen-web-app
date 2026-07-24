# Backend audit — Clauxen Web App

Generated: 2026-07-09. Source: repo migrations, MCP live checks, code grep.

## 1. Framework & runtime

| Component | Path / version | Role |
|-----------|----------------|------|
| Next.js | 16 App Router (`src/app/`) | UI + API routes on Vercel |
| Proxy | `src/proxy.ts` | Supabase cookie refresh; route guards (extended in this implementation) |
| Database | `pg` pool (`src/server/db/pool.ts`) | All app SQL — **not** PostgREST |
| Supabase Auth | `@supabase/ssr` (`src/utils/supabase/`) | GoTrue sessions (production target) |
| Dev auth | `clauxen_session` cookie + `AUTH_DEV_BYPASS` | Local development only |
| Background jobs | `scripts/worker.ts` (BullMQ + Redis) | Project file ingestion |

**Supabase project:** `clauxen-database-main` (`ntplcfsbcyhiqklkbldk`, us-west-1, ACTIVE_HEALTHY)  
**Vercel project:** `clauxen` (`prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr`, team `shirova-ai`)  
**Cloudflare Workers:** 0 deployed (R2 accessed via S3 SDK from Vercel today)

## 2. Data architecture (target)

```
Browser ──OAuth/email──► Supabase GoTrue
Browser ──API──────────► Next.js (Vercel) ──pg──► Supabase Postgres
Browser ──signed URL───► CF Worker (R2 gateway) ──► R2 buckets
                              ▲
                              └── validates Supabase JWT
```

| Store | Holds |
|-------|--------|
| **Supabase Postgres** | Users, profiles, settings, chats, messages, billing, metadata for files |
| **Cloudflare R2** | Binary blobs only (uploads, avatars, artifacts, skills, exports) |
| **CF Worker + Cache** | Auth-gated presign/download; cache public share previews |
| **D1** | **Not used.** Rationale: relational data belongs in Postgres; D1 would duplicate state. Future optional use: edge rate-limit counters only. |

## 3. Schema summary (public, 88 tables)

MCP `list_tables` + 28 local migrations. All tables have RLS enabled.

### Identity & settings
`profiles`, `user_settings`, `user_security_events`, `notification_preferences`, `connected_accounts`, `workspaces`, `workspace_*`, `sso_connections`, `scim_tokens`

### Chat
`chats`, `chat_messages`, `chat_branches`, `chat_message_parts`, `chat_message_reactions`, `pinned_chats`, `chat_branch_states`, `conversation_shares`

### Files & artifacts
`user_files`, `file_versions`, `file_processing_jobs`, `artifacts`, `artifact_versions`, `user_objects`

### Billing
`plans` (8 rows seeded), `subscriptions`, `billing_orders`, `billing_payments`, `token_transactions`, `user_balances`, `gift_*`, `razorpay_webhook_events`

### OAuth platform (enterprise — **not** user social login)
27 `oauth_*` tables for Clauxen-as-OAuth-provider. User social login uses **Supabase GoTrue** built-in providers.

### Customization & AI
`instruction_profiles`, `user_memories`, `connector_catalog`, `connector_installations`, `model_catalog`, `tool_calls`, `research_*`, `document_chunks`, `embeddings`

### Governance & ops
`data_export_jobs`, `data_deletion_requests`, `audit_logs`, `feature_flags`, `inference_gateway_requests`, `blocked-emails` (71k rows), worker job tables

## 4. Wired vs stubbed

### Implemented (repository/service/route exists)
- Identity: `identity.service.ts`, profiles bootstrap
- Settings: `settings.repository.ts`, `/api/v1/settings`
- Chats: `chats.repository.ts`, `messages.repository.ts`, `/api/v1/chats/*`
- Billing: `billing.repository.ts`, Razorpay webhooks, gifts
- Research, artifacts (metadata), customize, API keys, workspaces (read)
- Project files: `project-files.repository.ts` (**table missing — see drift**)
- User skills: `user-skills.repository.ts` (**table missing — see drift**)

### Schema only (no app usage found)
`library_items`, `saved_prompts`, `chat_message_parts`, `chat_message_reactions`, `pinned_chats`, `assistant_profiles`, `oauth_clients`, `model_router_rules`, `abuse_*`, worker rollup tables, model training governance tables, most `oauth_*` tables

### UI mock / local-only (pre-implementation)
- Onboarding: `localStorage` only — no `onboarding_completed` column
- Security settings: MFA/sessions UI mock
- Data controls / storage: hardcoded
- Connected apps: toggle flags in JSONB, no OAuth dance
- Google login button: stub error message
- `AuthDialog`: built but unused

## 5. Schema drift (flagged — do not guess)

| Issue | Detail | Resolution |
|-------|--------|------------|
| `project_files` | Queried in `project-files.repository.ts`; **not in Supabase migrations** | New migration `20260709100000_schema_drift_fixes.sql` |
| `user_skills` | Queried in `user-skills.repository.ts`; **not in migrations** | Same migration |
| `user_files` vs `project_files` | Platform schema has `user_files`; project code uses separate `project_files` | Keep both — different domains (general uploads vs project RAG) |
| Instagram OAuth | Not a built-in Supabase provider | **Skipped v1** — ship Google, GitHub, Facebook, Twitter/X |

## 6. Auth state (before wiring)

- Production target: Supabase GoTrue only (`AUTH_DEV_BYPASS=false`)
- Local dev: dev cookie bypass remains when `AUTH_DEV_BYPASS=true`
- `getSessionFromRequest` previously read `clauxen_session` UUID only — **now also reads Supabase session**
- No `/auth/callback` existed — **added**
- Supabase Dashboard: Google + GitHub enabled; Facebook + Twitter need credentials

## 7. MCP advisor findings (security)

INFO-level only:
- `blocked-emails`, `inference_gateway_requests`, `model_usage_realtime_windows`, `provider_capacity_windows` — RLS enabled, no policies (service-role only by design)

## 8. File storage state

- R2 via `@aws-sdk/client-s3` from Vercel (`object-store.ts`)
- Upload routes: project files, skills upload
- **No** presigned URLs, **no** CF Worker gateway
- `user_files` table exists but no repository (added in implementation)
- Supabase Storage buckets defined in migrations but app uses R2

## 9. Gap plan (implementation phases)

1. ✅ Audit doc (this file)
2. Auth: Supabase session bridge, callback routes, login/signup, route guards
3. Migrations: onboarding columns, `project_files`, `user_skills`
4. Onboarding API + UI persistence
5. CF Worker R2 gateway + presign APIs
6. Settings: security, data controls, storage, connected accounts
7. Core UX: share links, chat search, pinned chats
8. `.env.example`, README data-flow, vercel-deployment update

## 10. Environment variables (see `.env.example`)

Required for production auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `AUTH_DEV_BYPASS=false`, `NEXT_PUBLIC_APP_URL`

Required for R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`, bucket names

New: `WORKER_URL` (CF R2 gateway), `AUTH_REQUIRED_FOR_CHAT` (optional gate)
