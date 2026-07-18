---
name: clauxen-database
description: >-
  Clauxen Supabase Postgres: migrations, RLS, chat RPCs, Realtime publications, pgvector, pgmq. Use when writing SQL migrations, changing schema, RLS policies, SECURITY DEFINER RPCs, or querying chats/profiles/billing tables.
---

# Clauxen database

## Read first

- `docs/reference/database-schema.md`
- `.agents/skills/supabase/SKILL.md` and postgres best-practices skill when touching SQL

## SoR

Supabase Postgres is system of record. Apply via `npx supabase db push`.

## Hard rules

1. Prefer **additive** migrations.
2. Chat SECURITY DEFINER RPCs: **REVOKE EXECUTE** from anon/authenticated — service_role/postgres only.
3. Enable RLS; follow advisor cleanups.
4. `chats.id` is **text** (custom + legacy UUID strings).
5. Realtime: publish only what is needed; clients mute messages mid-SSE.
6. Pool: `DATABASE_POOL_MAX=1` per serverless isolate by default; prefer transaction pooler on Vercel.
7. No D1 as SoR; no Vectorize for product RAG.

## Key RPCs

`append_chat_message`, `fetch_chat_messages_page`, `enqueue_chat_job`, `gc_stale_streaming_messages`, transcript append helpers, `chat_id_exists`.

## Additional resources

- [reference.md](reference.md)
- Use Supabase MCP (`user-supabase`) for remote inspect when appropriate
