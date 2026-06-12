-- =============================================================================
-- Migration: 20260513120000_create_shirova_inference_gateway
-- Purpose: Persist Shirova inference gateway request telemetry for observability
--          and cost/latency analysis (Novita-backed chat/title modes).
-- Prerequisites:
--   - extensions schema (pgcrypto installed there on Supabase).
-- Apply-time behavior:
--   - Ensures pgcrypto in extensions schema.
--   - Creates inference_gateway_requests with status/mode CHECK constraints.
--   - Adds time-series and GIN indexes; enables RLS; service_role-only access.
-- Security / RLS:
--   - RLS enabled, no client policies: table is write/read via service_role only
--     (API route logs requests server-side).
-- Rollback guidance:
--   - DROP TABLE public.inference_gateway_requests;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extension: pgcrypto (UUID generation if needed elsewhere)
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Table: inference_gateway_requests
-- -----------------------------------------------------------------------------
create table if not exists public.inference_gateway_requests (
  id uuid primary key default gen_random_uuid(),
  gateway text not null default 'shirova',
  provider text not null default 'novita',
  mode text not null check (mode in ('chat', 'title')),
  model text not null,
  status text not null check (status in ('success', 'error')),
  prompt_message_count integer not null default 0,
  prompt_character_count integer not null default 0,
  response_character_count integer not null default 0,
  latency_ms integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  request_started_at timestamptz not null default now(),
  request_finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes: dashboards and metadata filters
-- -----------------------------------------------------------------------------
create index if not exists inference_gateway_requests_created_idx
  on public.inference_gateway_requests (created_at desc);

create index if not exists inference_gateway_requests_provider_status_idx
  on public.inference_gateway_requests (provider, status, created_at desc);

create index if not exists inference_gateway_requests_metadata_gin_idx
  on public.inference_gateway_requests using gin (metadata);

-- -----------------------------------------------------------------------------
-- Access control: service_role only (no browser exposure)
-- -----------------------------------------------------------------------------
alter table public.inference_gateway_requests enable row level security;

revoke all on table public.inference_gateway_requests from anon;
revoke all on table public.inference_gateway_requests from authenticated;

grant all on table public.inference_gateway_requests to service_role;
