-- =============================================================================
-- Migration: 20260828163000_cookie_consent_and_telemetry
-- Purpose: Persist cookie consent and first-party performance/advertising
--          telemetry gated by that consent. Browser clients never access these
--          tables directly; the Next.js API writes via the service-role pool.
-- Security:
--   - RLS enabled with no anon/authenticated policies.
--   - No raw IP or full user-agent. Country is coarse (ISO-3166 alpha-2).
-- Retention:
--   - Consent rows last for the life of the visitor/user record.
--   - Event rows are eligible for purge after 13 months (operational).
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  essential boolean not null default true,
  performance boolean not null,
  advertising boolean not null,
  source text not null default 'settings'
    check (source in ('accept_all', 'reject_all', 'settings', 'dismiss')),
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cookie_consents_visitor_id_len check (
    char_length(visitor_id) between 8 and 64
  ),
  constraint cookie_consents_country_len check (
    country_code is null or char_length(country_code) = 2
  )
);

create unique index if not exists cookie_consents_visitor_id_uidx
  on public.cookie_consents (visitor_id);

create index if not exists cookie_consents_user_id_idx
  on public.cookie_consents (user_id)
  where user_id is not null;

drop trigger if exists cookie_consents_set_updated_at on public.cookie_consents;
create trigger cookie_consents_set_updated_at
  before update on public.cookie_consents
  for each row execute function public.set_updated_at();

comment on table public.cookie_consents is
  'First-party cookie consent per anonymous visitor, linked to a user when signed in.';

create table if not exists public.cookie_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('performance', 'advertising')),
  event_type text not null,
  path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  country_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cookie_events_visitor_id_len check (
    char_length(visitor_id) between 8 and 64
  ),
  constraint cookie_events_event_type_len check (
    char_length(event_type) between 1 and 64
  ),
  constraint cookie_events_path_len check (
    path is null or char_length(path) <= 300
  ),
  constraint cookie_events_country_len check (
    country_code is null or char_length(country_code) = 2
  )
);

create index if not exists cookie_events_visitor_created_idx
  on public.cookie_events (visitor_id, created_at desc);

create index if not exists cookie_events_user_id_idx
  on public.cookie_events (user_id)
  where user_id is not null;

create index if not exists cookie_events_created_at_idx
  on public.cookie_events (created_at);

comment on table public.cookie_events is
  'First-party performance and advertising events, recorded only when consent allows the category.';

alter table public.cookie_consents enable row level security;
alter table public.cookie_events enable row level security;

revoke all on public.cookie_consents from public, anon, authenticated;
revoke all on public.cookie_events from public, anon, authenticated;
grant all on public.cookie_consents to service_role;
grant all on public.cookie_events to service_role;
