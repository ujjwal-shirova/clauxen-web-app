-- =============================================================================
-- Migration: 20260507170000_platform_primitives.sql
-- Platform primitives (enums, auth bootstrap, RPCs, storage, realtime)
-- =============================================================================
--
-- Purpose
--   Layers application primitives on top of platform_schema (20260507153000):
--   shared domain enums, workspace membership helpers, auth.user provisioning,
--   security-definer chat/file/RAG RPCs, search indexes, storage object policies,
--   and Supabase Realtime publication wiring.
--
-- Prerequisites
--   - 20260506160000_core_backend.sql (user_settings, user_balances, etc.)
--   - 20260507153000_platform_schema.sql (profiles, workspaces, chats, RAG tables)
--
-- Execution order (high level)
--   1. Extensions (pgcrypto, vector) — idempotent
--   2. Domain enums (workspace, chat, billing vocabulary)
--   3. RLS helper functions (auth.uid() wrappers, workspace membership)
--   4. Auth trigger + one-time backfill for pre-existing auth.users
--   5. Application RPCs (chat, search, embeddings, files, usage, storage)
--   6. Supporting indexes (FTS, GIN metadata, HNSW embeddings)
--   7. Storage RLS policies (generated-images, exports buckets)
--   8. Realtime publication + authenticated EXECUTE grants
--
-- Security model
--   - Helper/RPC functions marked SECURITY DEFINER run as owner; set search_path
--     to public (and auth where needed) to avoid search_path hijacking.
--   - Chat/file RPCs enforce auth.uid() ownership or workspace membership checks.
--   - Storage policies scope objects to bucket_id + first path segment = uid.
--   - record_model_usage has no auth.uid() guard: intended for service-role API.
--
-- Engineer notes
--   - Enum DO blocks swallow duplicate_object for safe re-runs.
--   - bootstrap_existing_auth_users() runs once at migration time (SELECT below).
--   - Trial token grant (5000) matches core_backend onboarding defaults.
--   - Re-running is safe: CREATE OR REPLACE, IF NOT EXISTS, DROP POLICY IF EXISTS.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;

create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- Domain enums
-- -----------------------------------------------------------------------------
-- Idempotent enum creation via DO/EXCEPTION duplicate_object.
-- Values align with CHECK constraints and app-layer TypeScript unions.

do $$
begin
  create type public.workspace_member_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null;
end $$;

comment on type public.workspace_member_role is
  'Workspace RBAC role: owner (full), admin, member, viewer (read-oriented).';

do $$
begin
  create type public.workspace_member_status as enum ('active', 'invited', 'suspended', 'removed');
exception when duplicate_object then null;
end $$;

comment on type public.workspace_member_status is
  'Membership lifecycle: active members pass is_workspace_member(); invited/suspended/removed are excluded.';

do $$
begin
  create type public.chat_status as enum ('active', 'archived', 'deleted');
exception when duplicate_object then null;
end $$;

comment on type public.chat_status is
  'Chat thread visibility; get_recent_chats filters active + archived_at is null.';

do $$
begin
  create type public.message_role as enum ('system', 'user', 'assistant', 'tool');
exception when duplicate_object then null;
end $$;

comment on type public.message_role is
  'OpenAI-compatible message roles stored on chat_messages.role.';

do $$
begin
  create type public.message_status as enum ('queued', 'streaming', 'complete', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

comment on type public.message_status is
  'Per-message delivery state for streaming and failure handling.';

do $$
begin
  create type public.artifact_kind as enum ('app', 'document', 'spreadsheet', 'presentation', 'image', 'code', 'other');
exception when duplicate_object then null;
end $$;

comment on type public.artifact_kind is
  'Artifact type discriminator for generated outputs and file-backed artifacts.';

do $$
begin
  create type public.processing_status as enum ('queued', 'running', 'complete', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

comment on type public.processing_status is
  'Async job state for file_processing_jobs and similar pipelines.';

do $$
begin
  create type public.payment_provider as enum ('razorpay');
exception when duplicate_object then null;
end $$;

comment on type public.payment_provider is
  'Billing integration identifier; extensible when additional providers ship.';

do $$
begin
  create type public.token_transaction_source as enum (
    'purchase', 'generation', 'chat', 'reward', 'web_search', 'web_extract', 'deep_research'
  );
exception when duplicate_object then null;
end $$;

comment on type public.token_transaction_source is
  'Ledger attribution for token debits/credits (maps to token_transactions.source).';

-- -----------------------------------------------------------------------------
-- RLS helper functions
-- -----------------------------------------------------------------------------
-- Small, STABLE security-definer helpers used by RLS policies and RPC guards.
-- Prefer these over inlining subqueries so membership logic stays centralized.

/*
 * current_profile_id()
 *
 * Returns auth.uid() as the active profile/user id. SQL wrapper for readability
 * in policies and views; no elevated privileges (not security definer).
 */
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

comment on function public.current_profile_id() is
  'Returns auth.uid(); alias for profile-scoped RLS and RPC readability.';

/*
 * is_workspace_owner(p_workspace_id)
 *
 * True when auth.uid() owns the workspace row (workspaces.owner_id).
 * SECURITY DEFINER to read workspaces regardless of caller RLS context.
 */
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  )
$$;

comment on function public.is_workspace_owner(uuid) is
  'True if auth.uid() is workspaces.owner_id for the given workspace.';

/*
 * is_workspace_member(p_workspace_id)
 *
 * True when caller is workspace owner OR an active workspace_members row.
 * Invited/suspended/removed members do not qualify.
 */
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  )
$$;

comment on function public.is_workspace_member(uuid) is
  'True if auth.uid() owns the workspace or is an active workspace_members row.';

-- -----------------------------------------------------------------------------
-- Workspace bootstrap (auth provisioning support)
-- -----------------------------------------------------------------------------

/*
 * create_default_workspace_for_user(p_user_id, p_email, p_display_name)
 *
 * Creates a personal workspace named "{display}'s workspace" on the free plan,
 * seeds workspace_members (owner), workspace_settings, and sets profiles.default_workspace_id
 * when unset. Idempotent member/settings inserts via ON CONFLICT DO NOTHING.
 *
 * Called from handle_new_user and bootstrap_existing_auth_users.
 * SECURITY DEFINER: runs as migration owner to bypass RLS on workspace tables.
 */
create or replace function public.create_default_workspace_for_user(
  p_user_id uuid,
  p_email text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(p_email, 'Clauxen'), '@', 1), 'Clauxen');

  insert into public.workspaces (name, owner_id, plan_id, metadata)
  values (v_name || '''s workspace', p_user_id, 'free', jsonb_build_object('createdBy', 'auth_trigger'))
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (v_workspace_id, p_user_id, 'owner', 'active', now())
  on conflict (workspace_id, user_id) do nothing;

  insert into public.workspace_settings (workspace_id)
  values (v_workspace_id)
  on conflict (workspace_id) do nothing;

  update public.profiles
  set default_workspace_id = coalesce(default_workspace_id, v_workspace_id)
  where id = p_user_id;

  return v_workspace_id;
end;
$$;

comment on function public.create_default_workspace_for_user(uuid, text, text) is
  'Provisions default free workspace + owner membership for a new or backfilled user.';

-- -----------------------------------------------------------------------------
-- Auth trigger: provision profile, settings, balance, workspace on signup
-- -----------------------------------------------------------------------------

/*
 * handle_new_user()
 *
 * AFTER INSERT on auth.users: upserts public.profiles from raw_user_meta_data,
 * seeds user_settings, notification_preferences, trial user_balances (5000 tokens),
 * creates default workspace if user has no workspace_members row, and writes
 * audit_logs (auth.user_created).
 *
 * ON CONFLICT paths keep re-signup / OAuth re-link idempotent.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_url text;
  v_workspace_id uuid;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  v_avatar_url := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');

  insert into public.profiles (id, email, display_name, avatar_url, locale, timezone)
  values (new.id, new.email, v_display_name, v_avatar_url, 'en', 'UTC')
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  insert into public.user_settings (
    user_id, email, display_name, avatar_url, settings, chat_model_id, response_style
  )
  values (
    new.id,
    new.email,
    v_display_name,
    v_avatar_url,
    '{}'::jsonb,
    'moonshotai/kimi-k2.6',
    'balanced'
  )
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id, tokens_total, tokens_consumed, tokens_remaining, status)
  values (new.id, 5000, 0, 5000, 'trial')
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.workspace_members where user_id = new.id) then
    v_workspace_id := public.create_default_workspace_for_user(new.id, new.email, v_display_name);
  end if;

  insert into public.audit_logs (user_id, workspace_id, actor_type, action, target_type, target_id, metadata)
  values (new.id, v_workspace_id, 'system', 'auth.user_created', 'user', new.id::text, jsonb_build_object('email', new.email));

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auth.users AFTER INSERT trigger fn: profile, settings, trial balance, workspace, audit.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

comment on trigger on_auth_user_created on auth.users is
  'Runs handle_new_user() after GoTrue signup to seed app tables for the new uid.';

/*
 * bootstrap_existing_auth_users()
 *
 * One-time backfill: iterates auth.users and applies the same provisioning as
 * handle_new_user (profiles, settings, prefs, balance, workspace) without audit log.
 * Returns count of users processed. Invoked via SELECT at end of this section.
 *
 * search_path includes auth for auth.users visibility under SECURITY DEFINER.
 */
create or replace function public.bootstrap_existing_auth_users()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer := 0;
  v_user record;
begin
  for v_user in select * from auth.users loop
    insert into public.profiles (id, email, display_name, avatar_url)
    values (
      v_user.id,
      v_user.email,
      coalesce(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name', split_part(v_user.email, '@', 1)),
      coalesce(v_user.raw_user_meta_data ->> 'avatar_url', v_user.raw_user_meta_data ->> 'picture')
    )
    on conflict (id) do nothing;

    insert into public.user_settings (user_id, email, display_name, avatar_url, settings)
    values (
      v_user.id,
      v_user.email,
      coalesce(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name', split_part(v_user.email, '@', 1)),
      coalesce(v_user.raw_user_meta_data ->> 'avatar_url', v_user.raw_user_meta_data ->> 'picture'),
      '{}'::jsonb
    )
    on conflict (user_id) do nothing;

    insert into public.notification_preferences (user_id)
    values (v_user.id)
    on conflict (user_id) do nothing;

    insert into public.user_balances (user_id, tokens_total, tokens_consumed, tokens_remaining, status)
    values (v_user.id, 5000, 0, 5000, 'trial')
    on conflict (user_id) do nothing;

    if not exists (select 1 from public.workspace_members where user_id = v_user.id) then
      perform public.create_default_workspace_for_user(
        v_user.id,
        v_user.email,
        coalesce(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name', split_part(v_user.email, '@', 1))
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.bootstrap_existing_auth_users() is
  'Backfills profiles/settings/balance/workspace for all auth.users; run once at migrate.';

-- Executes backfill during migration apply (not a persistent cron).
select public.bootstrap_existing_auth_users();

-- -----------------------------------------------------------------------------
-- Application RPCs (chat, search, RAG, files, usage, storage metadata)
-- -----------------------------------------------------------------------------
-- Granted to authenticated at end of file. All user-scoped RPCs check auth.uid().

/*
 * create_chat(...)
 *
 * Inserts a chats row for auth.uid(). Optional workspace_id requires membership.
 * Default model_id matches user_settings onboarding default.
 */
create or replace function public.create_chat(
  p_title text default 'New chat',
  p_workspace_id uuid default null,
  p_project_id uuid default null,
  p_model_id text default 'moonshotai/kimi-k2.6'
)
returns public.chats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat public.chats;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_workspace_id is not null and not public.is_workspace_member(p_workspace_id) then
    raise exception 'Workspace access denied';
  end if;

  insert into public.chats (user_id, workspace_id, project_id, title, model_id)
  values (auth.uid(), p_workspace_id, p_project_id, coalesce(nullif(trim(p_title), ''), 'New chat'), p_model_id)
  returning * into v_chat;

  return v_chat;
end;
$$;

comment on function public.create_chat(text, uuid, uuid, text) is
  'Creates a chat for auth.uid(); optional workspace requires is_workspace_member.';

/*
 * append_chat_message(...)
 *
 * Inserts chat_messages for a chat owned by auth.uid(). Clamps token counts >= 0.
 * Auto-titles chat from first user message when title is still "New chat".
 */
create or replace function public.append_chat_message(
  p_chat_id uuid,
  p_role text,
  p_content text,
  p_content_json jsonb default '{}'::jsonb,
  p_branch_id uuid default null,
  p_parent_message_id uuid default null,
  p_model_id text default null,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.chat_messages;
begin
  if not exists (select 1 from public.chats c where c.id = p_chat_id and c.user_id = auth.uid()) then
    raise exception 'Chat access denied';
  end if;

  insert into public.chat_messages (
    chat_id, user_id, branch_id, parent_message_id, role, content, content_json,
    model_id, input_tokens, output_tokens
  )
  values (
    p_chat_id,
    auth.uid(),
    p_branch_id,
    p_parent_message_id,
    p_role,
    p_content,
    coalesce(p_content_json, '{}'::jsonb),
    p_model_id,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0)
  )
  returning * into v_message;

  update public.chats
  set updated_at = now(),
      title = case when title = 'New chat' and p_role = 'user' then left(p_content, 80) else title end
  where id = p_chat_id;

  return v_message;
end;
$$;

comment on function public.append_chat_message(uuid, text, text, jsonb, uuid, uuid, text, integer, integer) is
  'Appends a message to an owned chat; auto-titles from first user content.';

/*
 * get_recent_chats(p_limit, p_offset)
 *
 * Returns active, non-archived chats for auth.uid() ordered by updated_at desc.
 * Clamps limit to [1, 100] and offset >= 0.
 */
create or replace function public.get_recent_chats(
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.chats
language sql
security definer
set search_path = public
as $$
  select *
  from public.chats
  where user_id = auth.uid()
    and archived_at is null
    and status = 'active'
  order by updated_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

comment on function public.get_recent_chats(integer, integer) is
  'Paginated active chats for auth.uid(); limit capped at 100.';

/*
 * search_user_messages(p_query, p_limit)
 *
 * Full-text search over chat_messages.content (simple config) scoped to caller chats.
 * Uses chat_messages_content_fts_idx indirectly via to_tsvector match.
 */
create or replace function public.search_user_messages(
  p_query text,
  p_limit integer default 20
)
returns table (
  message_id uuid,
  chat_id uuid,
  title text,
  role text,
  content text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.chat_id, c.title, m.role, m.content, m.created_at
  from public.chat_messages m
  join public.chats c on c.id = m.chat_id
  where c.user_id = auth.uid()
    and m.content is not null
    and to_tsvector('simple', m.content) @@ plainto_tsquery('simple', p_query)
  order by ts_rank(to_tsvector('simple', m.content), plainto_tsquery('simple', p_query)) desc, m.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

comment on function public.search_user_messages(text, integer) is
  'FTS over owned chat messages; returns ranked hits with chat title (limit max 50).';

/*
 * match_document_chunks(query_embedding, match_count, filter)
 *
 * Cosine similarity search over embeddings joined to document_chunks.
 * filter: empty jsonb = no metadata filter; otherwise dc.metadata @> filter.
 * STABLE + SECURITY DEFINER; scoped to dc.user_id = auth.uid().
 */
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 10,
  filter jsonb default '{}'::jsonb
)
returns table (
  chunk_id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc.id as chunk_id,
    dc.source_type,
    dc.source_id,
    dc.content,
    dc.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.document_chunks dc on dc.id = e.chunk_id
  where dc.user_id = auth.uid()
    and (filter = '{}'::jsonb or dc.metadata @> filter)
  order by e.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50)
$$;

comment on function public.match_document_chunks(vector(1536), integer, jsonb) is
  'RAG retrieval: cosine-ranked chunks for auth.uid() with optional metadata @> filter.';

/*
 * queue_file_processing_job(p_file_id, p_job_type)
 *
 * Enqueues file_processing_jobs for an owned user_files row (default job_type index).
 */
create or replace function public.queue_file_processing_job(
  p_file_id uuid,
  p_job_type text default 'index'
)
returns public.file_processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.file_processing_jobs;
begin
  if not exists (select 1 from public.user_files where id = p_file_id and user_id = auth.uid()) then
    raise exception 'File access denied';
  end if;

  insert into public.file_processing_jobs (file_id, user_id, job_type, status)
  values (p_file_id, auth.uid(), p_job_type, 'queued')
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.queue_file_processing_job(uuid, text) is
  'Queues an index (or other) processing job for an owned user_files row.';

/*
 * record_model_usage(...)
 *
 * Inserts model_usage_events for billing/analytics. No auth.uid() check — call from
 * service-role API after inference. Clamps token counts >= 0.
 */
create or replace function public.record_model_usage(
  p_user_id uuid,
  p_workspace_id uuid,
  p_chat_id uuid,
  p_message_id uuid,
  p_provider text,
  p_model_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.model_usage_events (
    user_id, workspace_id, chat_id, message_id, provider, model_id,
    input_tokens, output_tokens, latency_ms, metadata
  )
  values (
    p_user_id, p_workspace_id, p_chat_id, p_message_id, p_provider, p_model_id,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    p_latency_ms,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_model_usage(uuid, uuid, uuid, uuid, text, text, integer, integer, integer, jsonb) is
  'Service-role analytics insert for model_usage_events; not end-user callable via grant.';

/*
 * create_storage_object_record(...)
 *
 * Upserts user_objects metadata row before/after Storage upload.
 * ON CONFLICT (bucket, object_path) refreshes file_name, content_type, metadata.
 */
create or replace function public.create_storage_object_record(
  p_bucket text,
  p_object_path text,
  p_file_name text,
  p_content_type text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_objects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_object public.user_objects;
begin
  insert into public.user_objects (user_id, bucket, object_path, file_name, content_type, status, metadata)
  values (auth.uid(), p_bucket, p_object_path, p_file_name, p_content_type, 'pending', coalesce(p_metadata, '{}'::jsonb))
  on conflict (bucket, object_path) do update set
    file_name = excluded.file_name,
    content_type = excluded.content_type,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into v_object;

  return v_object;
end;
$$;

comment on function public.create_storage_object_record(text, text, text, text, jsonb) is
  'Registers or updates user_objects for auth.uid() prior to Storage upload.';

-- -----------------------------------------------------------------------------
-- Search & RAG indexes
-- -----------------------------------------------------------------------------
-- Supporting indexes for FTS, JSONB metadata filters, and vector ANN search.

create index if not exists chat_messages_content_fts_idx
on public.chat_messages
using gin (to_tsvector('simple', coalesce(content, '')));

create index if not exists document_chunks_content_fts_idx
on public.document_chunks
using gin (to_tsvector('simple', content));

create index if not exists document_chunks_metadata_gin_idx
on public.document_chunks
using gin (metadata jsonb_path_ops);

create index if not exists embeddings_embedding_hnsw_idx
on public.embeddings
using hnsw (embedding vector_cosine_ops);

create index if not exists chats_metadata_gin_idx
on public.chats
using gin (metadata jsonb_path_ops);

create index if not exists artifacts_metadata_gin_idx
on public.artifacts
using gin (metadata jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- Storage RLS policies
-- -----------------------------------------------------------------------------
-- Path convention: {bucket}/{user_id}/... — first folder segment must equal auth.uid().
-- Buckets generated-images and exports are defined in platform_schema.

drop policy if exists "Users can read own generated images" on storage.objects;

create policy "Users can read own generated images"
on storage.objects for select to authenticated
using (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own generated images" on storage.objects;

create policy "Users can upload own generated images"
on storage.objects for insert to authenticated
with check (bucket_id = 'generated-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can read own exports" on storage.objects;

create policy "Users can read own exports"
on storage.objects for select to authenticated
using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own exports" on storage.objects;

create policy "Users can upload own exports"
on storage.objects for insert to authenticated
with check (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Supabase Realtime publication
-- -----------------------------------------------------------------------------
-- Idempotent add table to supabase_realtime for live UI subscriptions.

do $$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.artifacts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.file_processing_jobs;
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- RPC grants (authenticated role)
-- -----------------------------------------------------------------------------
-- Exposes user-facing RPCs to PostgREST; record_model_usage intentionally omitted.

grant execute on function public.create_chat(text, uuid, uuid, text) to authenticated;

grant execute on function public.append_chat_message(uuid, text, text, jsonb, uuid, uuid, text, integer, integer) to authenticated;

grant execute on function public.get_recent_chats(integer, integer) to authenticated;

grant execute on function public.search_user_messages(text, integer) to authenticated;

grant execute on function public.match_document_chunks(vector(1536), integer, jsonb) to authenticated;

grant execute on function public.queue_file_processing_job(uuid, text) to authenticated;

grant execute on function public.create_storage_object_record(text, text, text, text, jsonb) to authenticated;
