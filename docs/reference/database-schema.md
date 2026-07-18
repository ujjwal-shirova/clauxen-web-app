# Database Schema

Source of truth: `supabase/migrations/*.sql` applied with `npx supabase db push` / `npm run supabase:db:push`.

Supabase Postgres is the **system of record** for relational data. Binaries live in R2. Embeddings live in pgvector columns — not Cloudflare Vectorize.

---

## 1. Migration timeline (high level)

Base platform schema begins at `20260507153000_platform_schema.sql`, then expands through:

- Billing / gifts hardening
- Operational edge worker job tables
- Realtime publications
- Security advisor hardening / RLS cleanup
- Performance advisor indexes
- OAuth provider tables / identity expansion
- Model training governance
- Shirova inference gateway requests
- Blocked emails
- Personal plans catalog + Pro yearly
- Schema drift + onboarding
- Profiles preferred_name + realtime
- Chats id → text custom format
- Chat transcript JSONL
- Chat messages keyset pagination RPCs
- Projects / user_skills alignment
- Chat turn integrity + history hardening
- Background queues (pgmq) + GC stale streaming messages

Always read the latest migration when a column seems missing — schema drifts across many files.

---

## 2. Core identity & tenancy

### `profiles`

Mirrors `auth.users`. Typical columns: id (FK auth.users), display_name, preferred_name, avatar_url, onboarding fields, timestamps.

Trigger: `handle_new_user` (+ X OAuth metadata variant).

Realtime: profiles published for client sync where enabled.

### `workspaces` / `workspace_roles` / `workspace_members` / `workspace_invites` / `workspace_settings`

Team tenancy. Members link users to workspaces with roles.

### `workspace_domains` / `sso_connections` / `scim_tokens`

Enterprise domain verification, SSO, SCIM provisioning tokens.

### `notification_preferences` / `connected_accounts`

Per-user notification toggles and linked OAuth accounts.

### `user_security_events`

Audit trail for sensitive auth/security actions.

---

## 3. Chat domain

### `chats`

| Concern | Notes |
|---|---|
| `id` | **text** — custom long ids + legacy UUIDs |
| ownership | user_id / workspace as designed |
| `project_id` | optional FK to projects |
| title / model / metadata | listing fields |
| soft delete | where present |

RPCs: `chat_id_exists`, list helpers.

### `chat_messages`

Turn store: role, content, content_json, status (streaming/completed/error/cancelled), ordering, branch parentage.

Keyset pagination via `fetch_chat_messages_page`.

Append helper: `append_chat_message` (SECURITY DEFINER — **service_role only**; anon/authenticated EXECUTE revoked).

### `chat_message_parts`

Structured parts: text segments, `file_id` attachments, tool payloads.

### `chat_branches` / `chat_message_reactions` / `pinned_chats`

Branch metadata, reactions, pin overrides (optimistic UI until list agrees).

### `chat_transcript_lines`

Training JSONL records. Helpers: `append_chat_transcript_line`, `replace_chat_transcript_lines`.

View: `chat_transcripts_jsonl`.

### Background

- `enqueue_chat_job` + pgmq queues for title/embed/GC work
- `gc_stale_streaming_messages` cleans abandoned streaming rows

---

## 4. Files & artifacts

### `user_files` / `file_versions` / `file_processing_jobs`

Metadata for R2 objects (bucket, key, mime, size, status). Bytes never in Postgres.

### `artifacts` / `artifact_versions` / `artifact_jobs`

Generated artifact documents and async jobs.

### `library_items` / `saved_prompts`

Library surface + prompt library.

---

## 5. Projects & RAG

### `projects` / `project_members` / `project_files`

Project folders, membership, uploaded files for RAG.

### `document_chunks` / `embeddings`

Chunk text + pgvector embeddings for retrieval.

### Project chats

Link tables / columns associating chats with projects (`project_chats` repository alignment migration).

Ingestion often goes through BullMQ (`npm run worker`) with Redis, falling back to inline if `REDIS_URL` unset.

---

## 6. Billing

### `plans`

Catalog (personal plans + Pro yearly 20% migration). Seeded in SQL migrations.

### `subscriptions`

User/workspace subscription state, Razorpay ids, period, status.

### `webhook_events`

Idempotent Razorpay webhook intake.

### `gift_codes` / `gift_redemptions` / `gift_delivery_jobs`

Gift purchase + redeem + async delivery.

### `subscription_activation_events` / `usage_daily_rollups`

Activation audit + usage rollups.

---

## 7. Models, tools, research

### `model_catalog` / `model_usage_events` / `record_model_usage`

Catalog + usage telemetry.

### `tool_calls` / `research_sources`

Persisted tool invocations and research citations.

### Training governance

`model_training_consent_events`, `model_usage_realtime_windows`, `model_priority_runtime_snapshots`, `provider_capacity_windows`.

### `inference_gateway_requests`

Shirova gateway request log table.

---

## 8. Customize / memory / safety

### `user_skills` / `connector_catalog` / `connector_installations`

User-uploaded skills and connectors.

### `user_memories` / `memory_events` / `instruction_profiles` / `assistant_profiles` / `assistant_versions`

Memory and assistant personalization structures.

### `safety_policy_rules` / `moderation_events` / `abuse_reports` / `abuse_signals`

Safety and abuse.

### `data_export_jobs` / `data_deletion_requests`

Privacy controls.

### `conversation_shares`

Share tokens for public `/share/[token]`.

### `feature_flags` / `audit_logs` / `api_keys`

Flags, audit, programmatic keys (`clx_…`).

---

## 9. OAuth provider platform tables

Large expansion in `platform_extension_identity_expansion.sql`:

`oauth_scopes`, `oauth_clients`, `oauth_client_redirect_uris`, `oauth_consent_grants`, `oauth_authorization_requests`, `oauth_authorization_codes`, `oauth_refresh_token_families`, `oauth_refresh_tokens`, `oauth_access_tokens`, `oauth_device_codes`, `oauth_jwks`, `oauth_events`.

These support first-party OAuth/OIDC style expansion beyond Supabase social login.

---

## 10. Onboarding

### `onboarding_answers` (+ integrity migrations)

Stores step answers. Grandfather migration marks existing users complete.

Related profile columns for name/role hydrate settings.

---

## 11. Blocked emails

`blocked_emails` / domain seed via `npm run supabase:blocked-emails:seed`.

Used by validate-email paths.

---

## 12. RLS & security posture

Multiple advisor migrations:

- Enable RLS where missing
- Tighten policies
- Lock down GraphQL where needed while keeping Studio visibility
- Revoke anon/authenticated EXECUTE on sensitive SECURITY DEFINER chat RPCs
- Prefer service_role for server repositories using `DATABASE_URL` / service client

**App pattern:** Next.js server uses `pg` pool (`DATABASE_URL`, `DATABASE_POOL_MAX=1` default per isolate) and/or service role carefully. Browser uses anon key under RLS.

Hyperdrive in chat-history Worker uses user JWT + anon for authorized reads (cache keyed accordingly).

---

## 13. Realtime publications

Published tables (see realtime migrations) typically include:

- `chats`
- `chat_messages` (client must mute mid-SSE)
- `profiles`
- files-related where enabled

Broadcast channels used for presence — not WAL.

Drop migration exists for realtime tables without id (cleanup).

---

## 14. Connection guidance

| Context | Connection |
|---|---|
| Vercel serverless | Transaction pooler `:6543` preferred for high concurrency |
| Long migrations / admin | Session mode `:5432` |
| Pool size | `DATABASE_POOL_MAX=1` per isolate unless budget increased |
| Region | Vercel `pdx1` near Supabase `us-west-1` |

---

## 15. Related

- [`../systems/chat-system.md`](../systems/chat-system.md)
- [`../systems/projects-and-rag.md`](../systems/projects-and-rag.md)
- [`../ops/security.md`](../ops/security.md)
