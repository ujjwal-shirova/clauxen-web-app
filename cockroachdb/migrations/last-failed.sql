-- Source: 20260507153000_platform_schema.sql
-- Batched 30 statements
-- Error: column "provider_order_id" is being backfilled

alter table public.chat_message_parts
  add constraint chat_message_parts_artifact_fk
  foreign key (artifact_id) references public.artifacts(id) on delete set null;
-- -----------------------------------------------------------------------------
-- Models, tool calls & usage metering
-- -----------------------------------------------------------------------------

-- model_catalog: provider models, pricing, and capability flags for the picker.
create table if not exists public.model_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null,
  display_name text not null,
  capabilities jsonb not null default '[]'::jsonb,
  input_token_price numeric(12, 8) not null default 0,
  output_token_price numeric(12, 8) not null default 0,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model_id)
);
-- omitted on CRDB: COMMENT ON metadata

-- model_usage_events: append-only inference billing / analytics per request.
create table if not exists public.model_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  provider text not null,
  model_id text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer generated always as (input_tokens + output_tokens) stored,
  cost_amount numeric(12, 6),
  currency text not null default 'USD',
  latency_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- tool_calls: agent tool invocations (input/output, status, latency).
create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  tool_name text not null,
  provider text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  error jsonb,
  latency_ms integer,
  created_at timestamptz not null default now()
);
alter table public.chat_message_parts
  add constraint chat_message_parts_tool_call_fk
  foreign key (tool_call_id) references public.tool_calls(id) on delete set null;
-- -----------------------------------------------------------------------------
-- Research & RAG (retrieval / “memory” for documents)
-- -----------------------------------------------------------------------------
-- Note: long-term conversational memory is a user_settings flag only here;
-- document_chunks + embeddings back file/chat RAG, not chat history memory.

alter table public.research_runs
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists chat_id uuid references public.chats(id) on delete set null;
-- research_sources: citations gathered during a research_runs session.
create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.research_runs(id) on delete cascade,
  url text not null,
  title text,
  publisher text,
  published_at timestamptz,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- document_chunks: text segments from files/chats for semantic search.
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- omitted on CRDB: COMMENT ON metadata

-- embeddings: pgvector(1536) vectors keyed to document_chunks (requires vector ext).
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.document_chunks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null,
  model_id text not null,
  embedding VECTOR(1536),
  dimensions integer not null default 1536,
  created_at timestamptz not null default now()
);
-- omitted on CRDB: COMMENT ON metadata

-- -----------------------------------------------------------------------------
-- Billing extensions (plans, subscriptions, workspace scoping)
-- -----------------------------------------------------------------------------
-- Extends core_backend billing_* tables with workspace_id and provider fields.

-- plans: product catalog (free/pro/team) with INR pricing and feature limits.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  display_name text not null,
  price_paise_monthly integer not null default 0,
  price_paise_yearly integer not null default 0,
  currency text not null default 'INR',
  token_grant integer not null default 0,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- omitted on CRDB: COMMENT ON metadata

-- subscriptions: user or workspace subscription linked to Razorpay (default).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  plan_id text references public.plans(id) on delete set null,
  provider text not null default 'razorpay',
  provider_subscription_id text,
  status text not null default 'trialing',
  billing_cycle text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- omitted on CRDB: COMMENT ON metadata

-- Backfill provider-neutral columns on core billing tables; migrate legacy ids.
alter table public.billing_orders
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists provider text not null default 'razorpay',
  add column if not exists provider_order_id text;
update public.billing_orders
set provider_order_id = razorpay_order_id
where provider_order_id is null;
alter table public.billing_payments
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists provider text not null default 'razorpay',
  add column if not exists provider_payment_id text;
update public.billing_payments
set provider_payment_id = id
where provider_payment_id is null;
alter table public.token_transactions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.user_balances
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
-- -----------------------------------------------------------------------------
-- Platform operations & governance
-- -----------------------------------------------------------------------------

-- webhook_events: idempotent ingest log for payment/provider webhooks.
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
-- audit_logs: cross-cutting activity log (user actions, admin events).
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  target_type text,
  target_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- api_keys: hashed programmatic keys (prefix shown in UI; never store plaintext).
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
-- abuse_reports: user-submitted moderation tickets with review workflow.
create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  category text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- feature_flags: runtime toggles with rollout/condition json for gradual release.
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  rollout jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Extend core rate_limits with generic subject/action dimensions for API throttling.
alter table public.rate_limits
  add column if not exists subject_type text,
  add column if not exists subject_id text,
  add column if not exists action text;
-- -----------------------------------------------------------------------------
-- Supabase Storage buckets
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('generated-images', 'generated-images', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;
-- -----------------------------------------------------------------------------
-- Row Level Security: enable on all platform tables
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_security_events enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_roles enable row level security;
alter table public.workspace_members enable row level security;
