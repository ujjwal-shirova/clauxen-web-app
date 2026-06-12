-- =============================================================================
-- Migration: 20260508102000_platform_extension_identity_expansion.sql
-- Platform extension bootstrap + identity / OAuth / day-one product tables
-- =============================================================================
--
-- Purpose
--   Layer two expansion on top of platform_schema (20260507153000):
--   (1) Enable Postgres extensions and infra schemas used by search, queues,
--       audit, GraphQL readiness, and crypto; harden non-public schemas.
--   (2) Add accent-insensitive FTS columns on chat_messages / document_chunks.
--   (3) Provision PGMQ worker queues for async backend jobs.
--   (4) Introduce OAuth 2.0 / OIDC provider tables ("Continue with Clauxen").
--   (5) Add ChatGPT/Claude-style product primitives: memory, assistants,
--       connectors, model router, safety, exports/deletion, sharing, SSO/SCIM.
--
-- Prerequisites
--   - 20260506160000_core_backend.sql (chats, chat_messages, workspaces, …)
--   - 20260507153000_platform_schema.sql (ensure_updated_at_trigger, RLS patterns)
--
-- Extensions enabled (best-effort; missing extensions log NOTICE, do not fail)
--   unaccent, citext, fuzzystrmatch, btree_gin/gist, bloom, ltree, pg_jsonschema,
--   pgstattuple, pg_walinspect, plpgsql_check, pg_partman, pgtap, pg_net, pgmq,
--   pgaudit, pg_graphql, pgsodium
--
-- Intentionally NOT enabled (attack surface / ops cost with no product benefit)
--   PostGIS, routing, earthdistance, foreign servers, dblink, synchronous HTTP, …
--
-- Security model (summary)
--   - private, queues, net, partman, pgtap, pgsodium: service_role only
--   - New public tables: RLS on; sensitive OAuth/token tables → service_role
--   - User-owned rows: auth.uid() policies; workspace-scoped reads where noted
--   - private.enqueue_clauxen_job: service_role execute only
--   - public.search_user_messages: service_role execute (wraps auth.uid() inside)
--
-- Execution order (high level)
--   1. Infra schemas + extension bootstrap
--   2. FTS (clauxen_unaccent) + generated tsvector columns + GIN indexes
--   3. PGMQ queues + schema privilege hardening + pgaudit role
--   4. OAuth enums + tables + COMMENT ON
--   5. Product tables (memory, assistants, connectors, …) + COMMENT ON
--   6. RLS enablement, updated_at triggers, policies
--   7. Indexes (incl. optional pg_trgm), seed data, helper functions, ANALYZE
--
-- Rollback guidance (destructive; run only in non-prod or with backups)
--   Drop new public tables in reverse FK order; drop clauxen_unaccent config;
--   revoke extension schemas; extensions themselves usually left installed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Infrastructure schemas (extension homes + operator-only surfaces)
-- -----------------------------------------------------------------------------
-- extensions: unaccent, citext, pg_jsonschema, pgaudit, …
-- private:    security-definer helpers (enqueue_clauxen_job)
-- queues:     PGMQ message queues (clauxen_*)
-- partman:    pg_partman (future partition maintenance)
-- pgsodium:   libsodium wrappers for field-level encryption
-- graphql / graphql_public: Supabase pg_graphql
-- net:        pg_net async HTTP (service_role only)
-- pgtap:      test harness (revoked from clients; removed in later migration)

create schema if not exists extensions;

create schema if not exists private;

create schema if not exists queues;

create schema if not exists partman;

create schema if not exists pgsodium;

create schema if not exists graphql;

create schema if not exists graphql_public;

create schema if not exists net;

create schema if not exists pgtap;

revoke all on schema private from public, anon, authenticated;

revoke all on schema queues from public, anon, authenticated;

grant usage on schema private to service_role;

grant usage on schema queues to service_role;

-- -----------------------------------------------------------------------------
-- Extension bootstrap (idempotent CREATE EXTENSION loop)
-- -----------------------------------------------------------------------------
-- Each extension is created in its dedicated schema. Failures are logged as
-- NOTICE so managed Supabase tiers missing a given extension still apply cleanly.

do $$
declare
  v_extension record;
  v_extensions jsonb := '[
    {"name":"unaccent","schema":"extensions"},
    {"name":"citext","schema":"extensions"},
    {"name":"fuzzystrmatch","schema":"extensions"},
    {"name":"btree_gin","schema":"extensions"},
    {"name":"btree_gist","schema":"extensions"},
    {"name":"bloom","schema":"extensions"},
    {"name":"ltree","schema":"extensions"},
    {"name":"pg_jsonschema","schema":"extensions"},
    {"name":"pgstattuple","schema":"extensions"},
    {"name":"pg_walinspect","schema":"extensions"},
    {"name":"plpgsql_check","schema":"extensions"},
    {"name":"pg_partman","schema":"partman"},
    {"name":"pgtap","schema":"pgtap"},
    {"name":"pg_net","schema":"net"},
    {"name":"pgmq","schema":"queues"},
    {"name":"pgaudit","schema":"extensions"},
    {"name":"pg_graphql","schema":"graphql"},
    {"name":"pgsodium","schema":"pgsodium"}
  ]'::jsonb;
begin
  for v_extension in
    select value ->> 'name' as name, value ->> 'schema' as schema_name
    from jsonb_array_elements(v_extensions)
  loop
    begin
      execute format(
        'create extension if not exists %I with schema %I',
        v_extension.name,
        v_extension.schema_name
      );
    exception when others then
      raise notice 'Extension % could not be enabled: %', v_extension.name, sqlerrm;
    end;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Full-text search: accent-insensitive configuration + generated columns
-- -----------------------------------------------------------------------------
-- clauxen_unaccent: copies simple, maps tokens through extensions.unaccent.
-- Additive: existing search columns/indexes remain; new GIN indexes target
-- content_search_unaccent for international names, prompts, docs, and messages.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'unaccent') then
    if not exists (
      select 1
      from pg_ts_config
      where cfgnamespace = 'public'::regnamespace
        and cfgname = 'clauxen_unaccent'
    ) then
      create text search configuration public.clauxen_unaccent (copy = simple);
      alter text search configuration public.clauxen_unaccent
        alter mapping for hword, hword_part, word
        with extensions.unaccent, simple;
    end if;
  end if;
end $$;

-- Generated STORED tsvector columns (maintained on write; indexed with GIN below).
alter table public.chat_messages
  add column if not exists content_search_unaccent tsvector
  generated always as (
    to_tsvector('public.clauxen_unaccent'::regconfig, coalesce(content, ''))
  ) stored;

alter table public.document_chunks
  add column if not exists content_search_unaccent tsvector
  generated always as (
    to_tsvector('public.clauxen_unaccent'::regconfig, coalesce(content, ''))
  ) stored;

create index if not exists chat_messages_content_unaccent_gin_idx
on public.chat_messages using gin (content_search_unaccent)
where content is not null;

create index if not exists document_chunks_content_unaccent_gin_idx
on public.document_chunks using gin (content_search_unaccent);

-- -----------------------------------------------------------------------------
-- PGMQ: durable worker queues (service_role enqueue/dequeue only)
-- -----------------------------------------------------------------------------
-- Queue names map to backend domains: billing, chat, artifacts, embeddings,
-- research, notifications, webhooks, exports, oauth. App routes / edge workers
-- call private.enqueue_clauxen_job (whitelist) rather than touching PGMQ directly.

do $$
declare
  v_queue text;
begin
  if exists (select 1 from pg_extension where extname = 'pgmq') then
    foreach v_queue in array array[
      'clauxen_billing',
      'clauxen_chat',
      'clauxen_artifacts',
      'clauxen_embeddings',
      'clauxen_research',
      'clauxen_notifications',
      'clauxen_webhooks',
      'clauxen_exports',
      'clauxen_oauth'
    ] loop
      begin
        perform queues.create(v_queue);
      exception
        when duplicate_table then null;
        when unique_violation then null;
        when others then
          raise notice 'Queue % could not be created: %', v_queue, sqlerrm;
      end;
    end loop;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Schema privilege hardening (operator / service_role only)
-- -----------------------------------------------------------------------------
-- Revokes PUBLIC/anon/authenticated on infra schemas; grants service_role usage
-- and full table/routine access so workers can enqueue, call pg_net, etc.

do $$
declare
  v_schema text;
begin
  foreach v_schema in array array['queues', 'net', 'partman', 'pgtap', 'pgsodium'] loop
    if exists (select 1 from pg_namespace where nspname = v_schema) then
      begin
        execute format('revoke all on schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke schema privileges on %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant usage on schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant schema usage on %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('revoke all on all tables in schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke table privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('revoke all on all routines in schema %I from public, anon, authenticated', v_schema);
      exception when others then
        raise notice 'Could not revoke routine privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant all on all tables in schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant table privileges in %: %', v_schema, sqlerrm;
      end;

      begin
        execute format('grant execute on all routines in schema %I to service_role', v_schema);
      exception when others then
        raise notice 'Could not grant routine privileges in %: %', v_schema, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- pgAudit: compliance-oriented write/DDL/role logging for sensitive tables
-- -----------------------------------------------------------------------------
-- clauxen_pgaudit role receives DML on billing, subscriptions, api_keys, audit.
-- service_role is configured to log via pgaudit when the extension is present.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pgaudit') then
    create role clauxen_pgaudit noinherit;
  end if;
exception when duplicate_object then null;
when others then
  raise notice 'pgaudit role could not be created: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'clauxen_pgaudit') then
    grant select, insert, update, delete on public.billing_orders to clauxen_pgaudit;
    grant select, insert, update, delete on public.billing_payments to clauxen_pgaudit;
    grant select, insert, update, delete on public.subscriptions to clauxen_pgaudit;
    grant select, insert, update, delete on public.gift_codes to clauxen_pgaudit;
    grant select, insert, update, delete on public.api_keys to clauxen_pgaudit;
    grant select, insert, update, delete on public.audit_logs to clauxen_pgaudit;
    grant select, insert, update, delete on public.user_security_events to clauxen_pgaudit;

    if exists (select 1 from pg_roles where rolname = 'service_role') then
      begin
        execute 'alter role service_role set pgaudit.log = ''write, ddl, role''';
        execute 'alter role service_role set pgaudit.role = ''clauxen_pgaudit''';
      exception when others then
        raise notice 'pgaudit role settings could not be applied: %', sqlerrm;
      end;
    end if;
  end if;
end $$;

-- =============================================================================
-- DOMAIN: OAuth 2.0 / OpenID Connect provider ("Continue with Clauxen")
-- =============================================================================
-- Authorization-code + PKCE, hashed secrets at rest, rotating refresh families,
-- consent grants, JWKS for JWT signing, and RFC 8628 device flow support.
-- All token/code values are stored hashed; raw values never persist in Postgres.

-- -----------------------------------------------------------------------------
-- OAuth enums
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.oauth_client_type as enum ('confidential', 'public');
exception when duplicate_object then null;
end $$;

comment on type public.oauth_client_type is
  'OAuth client classification: confidential (has secret) or public (PKCE-only).';

do $$
begin
  create type public.oauth_client_status as enum ('draft', 'active', 'suspended', 'deleted');
exception when duplicate_object then null;
end $$;

comment on type public.oauth_client_status is
  'Lifecycle state for oauth_clients registration and admin suspension.';

do $$
begin
  create type public.oauth_token_status as enum ('active', 'consumed', 'revoked', 'expired');
exception when duplicate_object then null;
end $$;

comment on type public.oauth_token_status is
  'Shared status for codes, refresh/access tokens, and authorization requests.';

-- -----------------------------------------------------------------------------
-- OAuth catalog & client registration
-- -----------------------------------------------------------------------------

-- oauth_scopes: canonical scope keys (openid, profile, email, …) and claim mapping.
create table if not exists public.oauth_scopes (
  key text primary key,
  description text not null,
  claim_names text[] not null default '{}',
  is_default boolean not null default false,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

-- oauth_clients: registered third-party / first-party OAuth applications.
create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  client_id text not null unique,
  client_secret_hash text,
  client_type public.oauth_client_type not null default 'confidential',
  status public.oauth_client_status not null default 'draft',
  name text not null,
  description text,
  logo_url text,
  homepage_url text,
  terms_url text,
  privacy_url text,
  allowed_origins text[] not null default '{}',
  allowed_grant_types text[] not null default array['authorization_code', 'refresh_token'],
  allowed_response_types text[] not null default array['code'],
  require_pkce boolean not null default true,
  first_party boolean not null default false,
  jwks jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint oauth_clients_secret_required_for_confidential check (
    client_type = 'public' or client_secret_hash is not null
  )
);

-- oauth_client_redirect_uris: allowed redirect URIs per client (exact match at token exchange).
create table if not exists public.oauth_client_redirect_uris (
  id uuid primary key default gen_random_uuid(),
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  unique (oauth_client_id, redirect_uri)
);

-- oauth_consent_grants: user-approved scope grants (one row per user × client).
create table if not exists public.oauth_consent_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  scopes text[] not null,
  claims jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, oauth_client_id)
);

-- -----------------------------------------------------------------------------
-- OAuth authorization flow (PKCE, codes, tokens)
-- -----------------------------------------------------------------------------

-- oauth_authorization_requests: in-flight authorize endpoint state (PKCE challenge, TTL).
create table if not exists public.oauth_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null,
  state_hash text,
  nonce_hash text,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method in ('S256')),
  status public.oauth_token_status not null default 'active',
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);

-- oauth_authorization_codes: one-time exchangeable codes (hashed); 10-minute TTL.
create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  authorization_request_id uuid references public.oauth_authorization_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  code_hash text not null unique,
  redirect_uri text not null,
  scopes text[] not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method in ('S256')),
  nonce_hash text,
  status public.oauth_token_status not null default 'active',
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- oauth_refresh_token_families: rotation lineage; revoke family on reuse detection.
create table if not exists public.oauth_refresh_token_families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  status public.oauth_token_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- oauth_refresh_tokens: hashed refresh tokens with rotate-from/to links.
create table if not exists public.oauth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.oauth_refresh_token_families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  token_hash text not null unique,
  scopes text[] not null,
  status public.oauth_token_status not null default 'active',
  rotated_from_token_id uuid references public.oauth_refresh_tokens(id) on delete set null,
  rotated_to_token_id uuid references public.oauth_refresh_tokens(id) on delete set null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- oauth_access_tokens: short-lived bearer tokens (~15 min); optional refresh link.
create table if not exists public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  refresh_token_id uuid references public.oauth_refresh_tokens(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  token_hash text not null unique,
  scopes text[] not null,
  audience text,
  status public.oauth_token_status not null default 'active',
  expires_at timestamptz not null default now() + interval '15 minutes',
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- OAuth device flow & signing keys
-- -----------------------------------------------------------------------------

-- oauth_device_codes: RFC 8628 device authorization (TV / CLI clients).
create table if not exists public.oauth_device_codes (
  id uuid primary key default gen_random_uuid(),
  oauth_client_id uuid not null references public.oauth_clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  device_code_hash text not null unique,
  user_code_hash text not null unique,
  scopes text[] not null,
  status public.oauth_token_status not null default 'active',
  interval_seconds integer not null default 5 check (interval_seconds between 5 and 60),
  expires_at timestamptz not null default now() + interval '15 minutes',
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- oauth_jwks: published signing keys for ID/access JWT validation by relying parties.
create table if not exists public.oauth_jwks (
  id uuid primary key default gen_random_uuid(),
  key_id text not null unique,
  algorithm text not null default 'RS256',
  public_jwk jsonb not null,
  private_secret_ref text,
  status text not null default 'active' check (status in ('active', 'retiring', 'retired', 'compromised')),
  not_before timestamptz not null default now(),
  not_after timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- oauth_events: security/audit trail (login, consent, token issue, revocation, …).
create table if not exists public.oauth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  oauth_client_id uuid references public.oauth_clients(id) on delete set null,
  event_type text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.oauth_scopes is
  'Canonical OAuth/OIDC scope definitions and claim name mappings for token issuance.';

comment on table public.oauth_clients is
  'Registered OAuth 2.0 clients (confidential or public); secrets stored as hashes only.';

comment on table public.oauth_client_redirect_uris is
  'Exact redirect URIs permitted per OAuth client at authorization and token exchange.';

comment on table public.oauth_consent_grants is
  'End-user consent records: approved scopes per user and OAuth client.';

comment on table public.oauth_authorization_requests is
  'In-flight authorization requests with PKCE challenges; short TTL (~10 minutes).';

comment on table public.oauth_authorization_codes is
  'One-time authorization codes (hashed) bound to PKCE and redirect URI.';

comment on table public.oauth_refresh_token_families is
  'Refresh token rotation families; entire family revoked on suspected token reuse.';

comment on table public.oauth_refresh_tokens is
  'Hashed refresh tokens with rotation lineage within a family.';

comment on table public.oauth_access_tokens is
  'Short-lived access tokens (hashed); typically ~15 minute expiry.';

comment on table public.oauth_device_codes is
  'Device authorization grant codes (RFC 8628) for headless or TV-style clients.';

comment on table public.oauth_jwks is
  'JSON Web Key Set entries for signing OIDC ID tokens and validating issued JWTs.';

comment on table public.oauth_events is
  'OAuth provider audit events: authorization, token lifecycle, and security signals.';

-- =============================================================================
-- DOMAIN: AI product primitives (memory, assistants, connectors, compliance)
-- =============================================================================
-- Day-one ChatGPT/Claude-style capabilities: long-term memory, custom GPTs,
-- third-party connector registry, model routing, safety/moderation, GDPR-style
-- export/deletion, conversation sharing, and enterprise SSO/SCIM hooks.

-- -----------------------------------------------------------------------------
-- User memory & instruction profiles
-- -----------------------------------------------------------------------------

-- user_memories: distilled facts/preferences extracted from chats (confidence-scored).
create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  source_message_id uuid references public.chat_messages(id) on delete set null,
  memory_type text not null default 'preference',
  summary text not null,
  confidence numeric(5, 4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (status in ('active', 'archived', 'deleted', 'rejected')),
  pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- memory_events: append-only audit of memory create/update/archive/reject actions.
create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.user_memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source_message_id uuid references public.chat_messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- instruction_profiles: per-user "custom instructions" / personality presets.
create table if not exists public.instruction_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  instructions text not null,
  traits jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Custom assistants (GPT-style) & versioning
-- -----------------------------------------------------------------------------

-- assistant_profiles: user- or workspace-owned custom assistants (GPTs).
create table if not exists public.assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  slug text,
  name text not null,
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'workspace', 'public', 'unlisted')),
  system_prompt text,
  default_model_id text,
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- assistant_versions: immutable version history per assistant (prompt, model, capabilities).
create table if not exists public.assistant_versions (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references public.assistant_profiles(id) on delete cascade,
  version_number integer not null,
  system_prompt text,
  default_model_id text,
  capabilities jsonb not null default '[]'::jsonb,
  changelog text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assistant_id, version_number)
);

-- -----------------------------------------------------------------------------
-- Third-party connectors (catalog + per-user installations)
-- -----------------------------------------------------------------------------

-- connector_catalog: platform-defined integrations (Google, Slack, GitHub, …).
create table if not exists public.connector_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  provider text not null,
  auth_type text not null default 'oauth' check (auth_type in ('oauth', 'api_key', 'none')),
  scopes text[] not null default '{}',
  config_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'beta', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- connector_installations: user/workspace OAuth or API-key linkage to a catalog entry.
create table if not exists public.connector_installations (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.connector_catalog(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  settings jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connector_id, user_id, workspace_id)
);

-- -----------------------------------------------------------------------------
-- Model routing, provider health, safety & moderation
-- -----------------------------------------------------------------------------

-- model_router_rules: workspace-scoped routing rules (condition JSON → provider/model).
create table if not exists public.model_router_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  condition jsonb not null default '{}'::jsonb,
  provider text not null,
  model_id text not null,
  fallback_provider text,
  fallback_model_id text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- provider_health_checks: periodic upstream model/provider probe results.
create table if not exists public.provider_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text,
  status text not null check (status in ('healthy', 'degraded', 'down')),
  latency_ms integer,
  error_message text,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- safety_policy_rules: configurable moderation policy definitions (allow/warn/block/review).
create table if not exists public.safety_policy_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null,
  action text not null check (action in ('allow', 'warn', 'block', 'review')),
  severity integer not null default 1 check (severity between 1 and 5),
  rule jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- moderation_events: per-message or per-chat moderation decisions and metadata.
create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  policy_rule_id uuid references public.safety_policy_rules(id) on delete set null,
  provider text,
  decision text not null,
  severity integer,
  input_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Privacy, sharing & enterprise identity
-- -----------------------------------------------------------------------------

-- data_export_jobs: async account/workspace export jobs (object storage path when complete).
create table if not exists public.data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  export_type text not null default 'account',
  storage_bucket text,
  storage_path text,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- data_deletion_requests: verified GDPR-style deletion workflow state machine.
create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'running', 'complete', 'cancelled', 'failed')),
  requested_scope text not null default 'account',
  verification_token_hash text,
  verified_at timestamptz,
  scheduled_for timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- conversation_shares: shareable links to chats (hashed token; optional expiry).
create table if not exists public.conversation_shares (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_token_hash text not null unique,
  visibility text not null default 'link' check (visibility in ('link', 'workspace', 'public')),
  include_artifacts boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- workspace_domains: verified email domains for workspace auto-join / SSO routing.
create table if not exists public.workspace_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  domain extensions.citext not null,
  verification_token_hash text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, domain)
);

-- sso_connections: workspace OIDC or SAML IdP configuration (draft → active).
create table if not exists public.sso_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('oidc', 'saml')),
  issuer_url text,
  metadata_url text,
  entity_id text,
  status text not null default 'draft' check (status in ('draft', 'active', 'disabled')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- scim_tokens: hashed SCIM provisioning bearer tokens per workspace (enterprise).
create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.user_memories is
  'Long-term user memory snippets derived from chat; confidence-scored and archivable.';

comment on table public.memory_events is
  'Append-only audit log for memory lifecycle events tied to users and source messages.';

comment on table public.instruction_profiles is
  'Per-user custom instruction presets (traits JSON) applied to new conversations.';

comment on table public.assistant_profiles is
  'Custom assistant (GPT) definitions with visibility, default model, and capabilities.';

comment on table public.assistant_versions is
  'Immutable version history for assistant_profiles (prompt and capability snapshots).';

comment on table public.connector_catalog is
  'Platform catalog of third-party integrations available for user installation.';

comment on table public.connector_installations is
  'Per-user or per-workspace connector OAuth/API-key installations.';

comment on table public.model_router_rules is
  'Workspace model routing rules: JSON conditions map to provider/model with fallbacks.';

comment on table public.provider_health_checks is
  'Upstream LLM provider health probe results for routing and status dashboards.';

comment on table public.safety_policy_rules is
  'Configurable safety policy rules driving allow, warn, block, or review actions.';

comment on table public.moderation_events is
  'Recorded moderation decisions for chats/messages linked to policy rules.';

comment on table public.data_export_jobs is
  'Asynchronous account or workspace data export jobs with object storage targets.';

comment on table public.data_deletion_requests is
  'Verified account or workspace deletion requests with scheduling and completion timestamps.';

comment on table public.conversation_shares is
  'Shareable conversation links with hashed tokens and visibility controls.';

comment on table public.workspace_domains is
  'Email domains claimed by a workspace for verification and SSO domain routing.';

comment on table public.sso_connections is
  'Workspace SSO IdP connections (OIDC or SAML) including metadata and settings JSON.';

comment on table public.scim_tokens is
  'Hashed SCIM bearer tokens for enterprise user/group provisioning per workspace.';

-- -----------------------------------------------------------------------------
-- Row level security: bulk enable on all tables introduced above
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'oauth_scopes', 'oauth_clients', 'oauth_client_redirect_uris', 'oauth_consent_grants',
    'oauth_authorization_requests', 'oauth_authorization_codes', 'oauth_refresh_token_families',
    'oauth_refresh_tokens', 'oauth_access_tokens', 'oauth_device_codes', 'oauth_jwks',
    'oauth_events', 'user_memories', 'memory_events', 'instruction_profiles',
    'assistant_profiles', 'assistant_versions', 'connector_catalog', 'connector_installations',
    'model_router_rules', 'provider_health_checks', 'safety_policy_rules',
    'moderation_events', 'data_export_jobs', 'data_deletion_requests',
    'conversation_shares', 'workspace_domains', 'sso_connections', 'scim_tokens'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- updated_at triggers (tables with mutable updated_at column)
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'oauth_clients', 'user_memories', 'instruction_profiles', 'assistant_profiles',
    'connector_catalog', 'connector_installations', 'model_router_rules',
    'safety_policy_rules', 'data_export_jobs', 'sso_connections'
  ] loop
    perform public.ensure_updated_at_trigger(format('public.%I', t)::regclass);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- RLS: service_role full access on sensitive OAuth / ops tables
-- -----------------------------------------------------------------------------
-- Token tables, JWKS, moderation, SCIM, etc. are never exposed to authenticated
-- clients directly; API routes use service_role for issuance and validation.

do $$
declare
  t text;
begin
  foreach t in array array[
    'oauth_scopes', 'oauth_clients', 'oauth_client_redirect_uris',
    'oauth_authorization_requests', 'oauth_authorization_codes',
    'oauth_refresh_token_families', 'oauth_refresh_tokens', 'oauth_access_tokens',
    'oauth_device_codes', 'oauth_jwks', 'oauth_events', 'provider_health_checks',
    'safety_policy_rules', 'moderation_events', 'scim_tokens'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_service_role_all', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service_role_all',
      t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- RLS: authenticated user least-privilege policies
-- -----------------------------------------------------------------------------
-- Patterns: auth.uid() ownership, workspace_members active membership,
-- assistant public/unlisted visibility, connector catalog read for active/beta.

create policy "oauth_consent_grants_owner_read"
on public.oauth_consent_grants
for select to authenticated
using (user_id = (select auth.uid()));

create policy "oauth_consent_grants_service_role_all"
on public.oauth_consent_grants
for all to service_role
using (true)
with check (true);

create policy "user_memories_owner_manage"
on public.user_memories
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "memory_events_owner_read"
on public.memory_events
for select to authenticated
using (user_id = (select auth.uid()));

create policy "memory_events_service_role_all"
on public.memory_events
for all to service_role
using (true)
with check (true);

create policy "instruction_profiles_owner_manage"
on public.instruction_profiles
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "assistant_profiles_owner_or_public_read"
on public.assistant_profiles
for select to authenticated
using (
  visibility in ('public', 'unlisted')
  or owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = assistant_profiles.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);

create policy "assistant_profiles_owner_insert"
on public.assistant_profiles
for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.workspaces w
    where w.id = assistant_profiles.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "assistant_profiles_owner_update"
on public.assistant_profiles
for update to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.workspaces w
    where w.id = assistant_profiles.workspace_id
      and w.owner_id = (select auth.uid())
  )
)
with check (
  owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.workspaces w
    where w.id = assistant_profiles.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "assistant_profiles_owner_delete"
on public.assistant_profiles
for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1 from public.workspaces w
    where w.id = assistant_profiles.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "assistant_versions_visible_via_assistant"
on public.assistant_versions
for select to authenticated
using (
  exists (
    select 1 from public.assistant_profiles a
    where a.id = assistant_versions.assistant_id
      and (
        a.visibility in ('public', 'unlisted')
        or a.owner_user_id = (select auth.uid())
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = a.workspace_id
            and wm.user_id = (select auth.uid())
            and wm.status = 'active'
        )
      )
  )
);

create policy "assistant_versions_service_role_all"
on public.assistant_versions
for all to service_role
using (true)
with check (true);

create policy "connector_catalog_authenticated_read"
on public.connector_catalog
for select to authenticated
using (status in ('active', 'beta'));

create policy "connector_catalog_service_role_all"
on public.connector_catalog
for all to service_role
using (true)
with check (true);

create policy "connector_installations_owner_manage"
on public.connector_installations
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "model_router_rules_workspace_read"
on public.model_router_rules
for select to authenticated
using (
  workspace_id is null
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = model_router_rules.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = model_router_rules.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "model_router_rules_service_role_all"
on public.model_router_rules
for all to service_role
using (true)
with check (true);

create policy "data_export_jobs_owner_read"
on public.data_export_jobs
for select to authenticated
using (user_id = (select auth.uid()));

create policy "data_export_jobs_service_role_all"
on public.data_export_jobs
for all to service_role
using (true)
with check (true);

create policy "data_deletion_requests_owner_read"
on public.data_deletion_requests
for select to authenticated
using (user_id = (select auth.uid()));

create policy "data_deletion_requests_service_role_all"
on public.data_deletion_requests
for all to service_role
using (true)
with check (true);

create policy "conversation_shares_owner_read"
on public.conversation_shares
for select to authenticated
using (user_id = (select auth.uid()));

create policy "conversation_shares_service_role_all"
on public.conversation_shares
for all to service_role
using (true)
with check (true);

create policy "workspace_domains_member_read"
on public.workspace_domains
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_domains.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = workspace_domains.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "workspace_domains_service_role_all"
on public.workspace_domains
for all to service_role
using (true)
with check (true);

create policy "sso_connections_member_read"
on public.sso_connections
for select to authenticated
using (
  exists (
    select 1 from public.workspaces w
    where w.id = sso_connections.workspace_id
      and w.owner_id = (select auth.uid())
  )
);

create policy "sso_connections_service_role_all"
on public.sso_connections
for all to service_role
using (true)
with check (true);

-- -----------------------------------------------------------------------------
-- Indexes: OAuth provider, memory, assistants, connectors, compliance
-- -----------------------------------------------------------------------------
-- Partial indexes favor active/non-revoked rows where query paths are hot.
-- Optional pg_trgm GIN indexes below require pg_trgm (enabled in extension loop).

create index if not exists oauth_clients_owner_idx on public.oauth_clients (owner_user_id, created_at desc);

create index if not exists oauth_clients_workspace_idx on public.oauth_clients (workspace_id, created_at desc);

create index if not exists oauth_clients_status_idx on public.oauth_clients (status, created_at desc);

create index if not exists oauth_redirect_uris_client_idx on public.oauth_client_redirect_uris (oauth_client_id);

create index if not exists oauth_consent_user_client_idx on public.oauth_consent_grants (user_id, oauth_client_id) where revoked_at is null;

create index if not exists oauth_consent_client_idx on public.oauth_consent_grants (oauth_client_id);

create index if not exists oauth_auth_requests_client_expires_idx on public.oauth_authorization_requests (oauth_client_id, expires_at);

create index if not exists oauth_auth_requests_user_idx on public.oauth_authorization_requests (user_id, created_at desc);

create index if not exists oauth_auth_codes_client_expires_idx on public.oauth_authorization_codes (oauth_client_id, expires_at) where status = 'active';

create index if not exists oauth_auth_codes_request_idx on public.oauth_authorization_codes (authorization_request_id);

create index if not exists oauth_auth_codes_user_idx on public.oauth_authorization_codes (user_id, created_at desc);

create index if not exists oauth_refresh_families_user_client_idx on public.oauth_refresh_token_families (user_id, oauth_client_id, status);

create index if not exists oauth_refresh_families_client_idx on public.oauth_refresh_token_families (oauth_client_id, created_at desc);

create index if not exists oauth_refresh_tokens_family_status_idx on public.oauth_refresh_tokens (family_id, status, created_at desc);

create index if not exists oauth_refresh_tokens_user_idx on public.oauth_refresh_tokens (user_id, created_at desc);

create index if not exists oauth_refresh_tokens_client_idx on public.oauth_refresh_tokens (oauth_client_id, created_at desc);

create index if not exists oauth_refresh_tokens_rotated_from_idx on public.oauth_refresh_tokens (rotated_from_token_id);

create index if not exists oauth_refresh_tokens_rotated_to_idx on public.oauth_refresh_tokens (rotated_to_token_id);

create index if not exists oauth_access_tokens_user_client_idx on public.oauth_access_tokens (user_id, oauth_client_id, expires_at desc);

create index if not exists oauth_access_tokens_refresh_idx on public.oauth_access_tokens (refresh_token_id);

create index if not exists oauth_access_tokens_client_idx on public.oauth_access_tokens (oauth_client_id, created_at desc);

create index if not exists oauth_access_tokens_active_expires_idx on public.oauth_access_tokens (expires_at) where status = 'active';

create index if not exists oauth_device_codes_client_expires_idx on public.oauth_device_codes (oauth_client_id, expires_at) where status = 'active';

create index if not exists oauth_device_codes_user_idx on public.oauth_device_codes (user_id, created_at desc);

create index if not exists oauth_events_user_created_idx on public.oauth_events (user_id, created_at desc);

create index if not exists oauth_events_client_created_idx on public.oauth_events (oauth_client_id, created_at desc);

create index if not exists user_memories_user_status_idx on public.user_memories (user_id, status, updated_at desc);

create index if not exists user_memories_workspace_idx on public.user_memories (workspace_id, updated_at desc);

create index if not exists user_memories_source_message_idx on public.user_memories (source_message_id);

create index if not exists memory_events_memory_idx on public.memory_events (memory_id, created_at desc);

create index if not exists memory_events_user_idx on public.memory_events (user_id, created_at desc);

create index if not exists memory_events_source_message_idx on public.memory_events (source_message_id);

create index if not exists instruction_profiles_user_default_idx on public.instruction_profiles (user_id, is_default, updated_at desc);

create index if not exists instruction_profiles_workspace_idx on public.instruction_profiles (workspace_id, updated_at desc);

create index if not exists assistant_profiles_owner_idx on public.assistant_profiles (owner_user_id, updated_at desc);

create index if not exists assistant_profiles_workspace_idx on public.assistant_profiles (workspace_id, updated_at desc);

create index if not exists assistant_profiles_public_idx on public.assistant_profiles (visibility, updated_at desc) where status = 'active';

create index if not exists assistant_versions_assistant_idx on public.assistant_versions (assistant_id, version_number desc);

create index if not exists assistant_versions_created_by_idx on public.assistant_versions (created_by, created_at desc);

create index if not exists connector_installations_connector_idx on public.connector_installations (connector_id, updated_at desc);

create index if not exists connector_installations_user_idx on public.connector_installations (user_id, status, updated_at desc);

create index if not exists connector_installations_workspace_idx on public.connector_installations (workspace_id, status, updated_at desc);

create unique index if not exists connector_installations_user_global_unique_idx
on public.connector_installations (connector_id, user_id)
where workspace_id is null;

create index if not exists model_router_rules_workspace_priority_idx on public.model_router_rules (workspace_id, is_enabled, priority);

create index if not exists provider_health_provider_checked_idx on public.provider_health_checks (provider, model_id, checked_at desc);

create index if not exists moderation_events_user_created_idx on public.moderation_events (user_id, created_at desc);

create index if not exists moderation_events_workspace_created_idx on public.moderation_events (workspace_id, created_at desc);

create index if not exists moderation_events_chat_idx on public.moderation_events (chat_id, created_at desc);

create index if not exists moderation_events_message_idx on public.moderation_events (message_id, created_at desc);

create index if not exists moderation_events_policy_rule_idx on public.moderation_events (policy_rule_id, created_at desc);

create index if not exists data_export_jobs_user_status_idx on public.data_export_jobs (user_id, status, created_at desc);

create index if not exists data_export_jobs_workspace_idx on public.data_export_jobs (workspace_id, created_at desc);

create index if not exists data_deletion_requests_user_status_idx on public.data_deletion_requests (user_id, status, created_at desc);

create index if not exists data_deletion_requests_workspace_idx on public.data_deletion_requests (workspace_id, created_at desc);

create index if not exists conversation_shares_chat_idx on public.conversation_shares (chat_id, created_at desc);

create index if not exists conversation_shares_user_idx on public.conversation_shares (user_id, created_at desc);

create index if not exists workspace_domains_domain_idx on public.workspace_domains (domain);

create index if not exists sso_connections_workspace_idx on public.sso_connections (workspace_id, status);

create unique index if not exists sso_connections_workspace_provider_identity_idx
on public.sso_connections (workspace_id, provider, coalesce(issuer_url, entity_id, ''));

create index if not exists scim_tokens_workspace_idx on public.scim_tokens (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Optional fuzzy search indexes (pg_trgm)
-- -----------------------------------------------------------------------------
-- Assistant name, connector catalog name, and active memory summary search.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists assistant_profiles_name_trgm_idx on public.assistant_profiles using gin (name extensions.gin_trgm_ops) where status = ''active''';
    execute 'create index if not exists connector_catalog_name_trgm_idx on public.connector_catalog using gin (name extensions.gin_trgm_ops) where status in (''active'', ''beta'')';
    execute 'create index if not exists user_memories_summary_trgm_idx on public.user_memories using gin (summary extensions.gin_trgm_ops) where status = ''active''';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Seed data: baseline OIDC scopes + connector catalog shells
-- -----------------------------------------------------------------------------
-- Idempotent UPSERT: safe to re-run; updates descriptions/scopes on conflict.

insert into public.oauth_scopes (key, description, claim_names, is_default, is_sensitive)
values
  ('openid', 'Authenticate the user with Clauxen OpenID Connect.', array['sub'], true, false),
  ('profile', 'Read basic Clauxen profile claims.', array['name', 'picture', 'locale', 'zoneinfo'], true, false),
  ('email', 'Read verified email claims.', array['email', 'email_verified'], true, true),
  ('offline_access', 'Issue refresh tokens for long-lived access.', array[]::text[], false, true),
  ('workspace.read', 'Read workspace membership metadata.', array[]::text[], false, true),
  ('chat.read', 'Read selected chat metadata through approved APIs.', array[]::text[], false, true)
on conflict (key) do update
set description = excluded.description,
    claim_names = excluded.claim_names,
    is_default = excluded.is_default,
    is_sensitive = excluded.is_sensitive;

insert into public.connector_catalog (key, name, provider, auth_type, scopes, status, config_schema)
values
  ('google-drive', 'Google Drive', 'google', 'oauth', array['drive.readonly'], 'active', '{"type":"object"}'::jsonb),
  ('gmail', 'Gmail', 'google', 'oauth', array['gmail.readonly'], 'active', '{"type":"object"}'::jsonb),
  ('slack', 'Slack', 'slack', 'oauth', array['channels:read', 'chat:write'], 'active', '{"type":"object"}'::jsonb),
  ('github', 'GitHub', 'github', 'oauth', array['repo', 'read:user'], 'active', '{"type":"object"}'::jsonb),
  ('notion', 'Notion', 'notion', 'oauth', array[]::text[], 'active', '{"type":"object"}'::jsonb),
  ('figma', 'Figma', 'figma', 'oauth', array['files:read'], 'beta', '{"type":"object"}'::jsonb)
on conflict (key) do update
set name = excluded.name,
    provider = excluded.provider,
    auth_type = excluded.auth_type,
    scopes = excluded.scopes,
    status = excluded.status,
    config_schema = excluded.config_schema,
    updated_at = now();

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- private.enqueue_clauxen_job: whitelist-validated PGMQ send wrapper for workers.
create or replace function private.enqueue_clauxen_job(
  p_queue_name text,
  p_payload jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, queues, private, pg_temp
as $$
declare
  v_msg_id bigint;
begin
  if p_queue_name not in (
    'clauxen_billing',
    'clauxen_chat',
    'clauxen_artifacts',
    'clauxen_embeddings',
    'clauxen_research',
    'clauxen_notifications',
    'clauxen_webhooks',
    'clauxen_exports',
    'clauxen_oauth'
  ) then
    raise exception 'Queue is not allowed';
  end if;

  select queues.send(p_queue_name, p_payload, greatest(p_delay_seconds, 0))
  into v_msg_id;

  return v_msg_id;
end;
$$;

comment on function private.enqueue_clauxen_job(text, jsonb, integer) is
  'Enqueue a JSON payload onto an allow-listed clauxen_* PGMQ queue; service_role only.';

-- public.search_user_messages: accent-insensitive FTS over caller''s chat messages.
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
set search_path = public, extensions, pg_temp
as $$
  with q as (
    select websearch_to_tsquery('public.clauxen_unaccent'::regconfig, nullif(trim(p_query), '')) as query
  )
  select m.id, m.chat_id, c.title, m.role, m.content, m.created_at
  from q, public.chat_messages m
  join public.chats c on c.id = m.chat_id
  where q.query is not null
    and c.user_id = (select auth.uid())
    and m.content_search_unaccent @@ q.query
  order by ts_rank_cd(m.content_search_unaccent, q.query) desc, m.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

comment on function public.search_user_messages(text, integer) is
  'Websearch-style FTS over the caller''s messages using clauxen_unaccent; caps limit at 50.';

-- -----------------------------------------------------------------------------
-- Function grants & planner statistics
-- -----------------------------------------------------------------------------

revoke all on function private.enqueue_clauxen_job(text, jsonb, integer) from public, anon, authenticated;

grant execute on function private.enqueue_clauxen_job(text, jsonb, integer) to service_role;

revoke all on function public.search_user_messages(text, integer) from public, anon, authenticated;

grant execute on function public.search_user_messages(text, integer) to service_role;

-- Refresh statistics on high-churn tables after bulk DDL + seed inserts.
analyze public.oauth_clients;

analyze public.oauth_consent_grants;

analyze public.user_memories;

analyze public.assistant_profiles;

analyze public.connector_catalog;
