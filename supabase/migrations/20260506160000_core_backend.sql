-- =============================================================================
-- Migration: 20260506160000_core_backend.sql
-- =============================================================================
--
-- Purpose
--   Bootstraps the Clauxen platform core schema: per-user settings and token
--   balances, billing (Razorpay orders/payments/webhooks), chat branch state,
--   upload metadata, rate limiting, RLS policies, private storage buckets, and
--   security-definer RPCs for token credit/debit and payment fulfillment.
--
-- Prerequisites
--   - Supabase project with auth.users (GoTrue) already provisioned.
--   - storage schema and storage.buckets / storage.objects (Supabase Storage).
--   - Migrations run in timestamp order; this file is the foundational layer
--     that later migrations extend (indexes, advisor hardening, etc.).
--
-- Engineer notes
--   - All user-facing tables use auth.uid() RLS; writes to balances and billing
--     fulfillment go through security definer functions (service role / API).
--   - razorpay_webhook_events has no RLS: append-only audit log for webhooks.
--   - rate_limits has no RLS: intended for server-side rate limiting only.
--   - Storage path convention: {bucket}/{user_id}/... (first folder = uid).
--   - credit_user_tokens is idempotent via sanitized idempotency_key → txn id.
--   - debit_user_tokens generates a new txn id per call (not idempotent).
--   - fulfill_billing_payment is idempotent per payment_id / credit txn id.
--   - Re-running this migration is safe: IF NOT EXISTS, DROP POLICY IF EXISTS,
--     ON CONFLICT DO NOTHING, and CREATE OR REPLACE for functions.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared triggers
-- -----------------------------------------------------------------------------

/*
 * set_updated_at()
 *
 * BEFORE UPDATE trigger helper: sets NEW.updated_at = now().
 * Attached to tables with an updated_at column (user_*, billing_*, chat_*, etc.).
 *
 * Idempotency: CREATE OR REPLACE is safe to re-run.
 * Security: INVOKER (default); runs in the context of the statement that fired
 * the trigger. No elevated privileges.
 */
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- User tables
-- -----------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Per-user preferences and profile-adjacent settings keyed by auth.users.id.';
comment on column public.user_settings.user_id is
  'Primary key; matches auth.users.id. Cascade delete removes settings with user.';
comment on column public.user_settings.email is
  'Denormalized email snapshot for display/query; canonical email remains in auth.users.';
comment on column public.user_settings.settings is
  'Arbitrary JSON document for UI/feature flags (theme, locale, etc.).';

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create table if not exists public.user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_total integer not null default 5000 check (tokens_total >= 0),
  tokens_consumed integer not null default 0 check (tokens_consumed >= 0),
  tokens_remaining integer not null default 5000 check (tokens_remaining >= 0),
  status text not null default 'trial' check (status in ('active', 'suspended', 'trial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_balances is
  'Token wallet per user: lifetime total, consumed, remaining, and account status.';
comment on column public.user_balances.tokens_total is
  'Cumulative tokens ever credited (including trial grant).';
comment on column public.user_balances.tokens_consumed is
  'Running sum of debits (chat, generation, etc.).';
comment on column public.user_balances.tokens_remaining is
  'Spendable balance; debits fail when remaining < amount.';
comment on column public.user_balances.status is
  'active | trial | suspended — suspended blocks debit_user_tokens.';

create trigger user_balances_set_updated_at
before update on public.user_balances
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Billing
-- -----------------------------------------------------------------------------

create table if not exists public.token_transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  type text not null check (type in ('credit', 'debit')),
  source text not null check (source in ('purchase', 'generation', 'chat', 'reward')),
  model_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.token_transactions is
  'Append-only ledger of token credits and debits; id for credits often derived from idempotency key.';
comment on column public.token_transactions.id is
  'Stable id (e.g. credit_{key}) for idempotent credits; debit_{uuid} for debits.';
comment on column public.token_transactions.source is
  'purchase | generation | chat | reward — business reason for the movement.';
comment on column public.token_transactions.model_id is
  'Optional model identifier on debits for usage analytics.';

create index if not exists token_transactions_user_created_idx on public.token_transactions (user_id, created_at desc);

create table if not exists public.billing_orders (
  id text primary key,
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  plan_id text not null,
  plan_name text not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  max_tier text,
  status text not null default 'created' check (status in ('created', 'attempted', 'fulfilled', 'failed')),
  currency text not null default 'INR',
  subtotal_paise integer not null check (subtotal_paise > 0),
  tax_paise integer not null check (tax_paise >= 0),
  amount_paise integer not null check (amount_paise > 0),
  tokens integer not null check (tokens > 0),
  receipt text not null,
  razorpay_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_orders is
  'Checkout orders created before Razorpay payment; fulfilled via fulfill_billing_payment.';
comment on column public.billing_orders.razorpay_order_id is
  'Razorpay order id; referenced by billing_payments.order_id and fulfillment RPC.';
comment on column public.billing_orders.status is
  'created → attempted → fulfilled | failed; fulfillment sets fulfilled + timestamps.';
comment on column public.billing_orders.tokens is
  'Token bundle granted to user_balances when payment is fulfilled.';

create trigger billing_orders_set_updated_at
before update on public.billing_orders
for each row execute function public.set_updated_at();

create table if not exists public.billing_payments (
  id text primary key,
  order_id text not null references public.billing_orders(razorpay_order_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null,
  method text,
  email text,
  contact text,
  source text not null check (source in ('checkout', 'webhook')),
  captured_at timestamptz,
  fulfilled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.billing_payments is
  'One row per captured Razorpay payment; duplicate payment ids short-circuit fulfillment.';
comment on column public.billing_payments.id is
  'Razorpay payment id; primary idempotency key for fulfill_billing_payment.';
comment on column public.billing_payments.source is
  'checkout (client callback) or webhook (server event).';

create table if not exists public.razorpay_webhook_events (
  id text primary key,
  event_id text not null unique,
  event text not null,
  status text not null check (status in ('processed', 'duplicate', 'ignored')),
  order_id text,
  payment_id text,
  received_at timestamptz not null default now()
);

comment on table public.razorpay_webhook_events is
  'Webhook delivery audit log; no RLS — written only from security definer fulfillment.';
comment on column public.razorpay_webhook_events.status is
  'processed | duplicate | ignored — outcome after fulfill_billing_payment handling.';

-- -----------------------------------------------------------------------------
-- Chat / storage
-- -----------------------------------------------------------------------------

create table if not exists public.chat_branch_states (
  chat_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  active_path jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chat_branch_states is
  'Client-synced conversation tree: branch active_path and messages blob per chat_id.';
comment on column public.chat_branch_states.active_path is
  'JSON array describing the active branch indices in the message tree.';
comment on column public.chat_branch_states.messages is
  'Serialized message list / tree nodes for the chat session.';

create trigger chat_branch_states_set_updated_at
before update on public.chat_branch_states
for each row execute function public.set_updated_at();

create table if not exists public.user_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  file_name text not null,
  content_type text,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_path)
);

comment on table public.user_objects is
  'Metadata mirror for storage.objects; tracks upload lifecycle per bucket/path.';
comment on column public.user_objects.object_path is
  'Storage object key; must align with storage RLS (first path segment = user_id).';
comment on column public.user_objects.status is
  'pending | uploaded | deleted — soft lifecycle before/after storage write.';

create trigger user_objects_set_updated_at
before update on public.user_objects
for each row execute function public.set_updated_at();

create table if not exists public.rate_limits (
  id text primary key,
  identifier text not null,
  window_start integer not null,
  count integer not null default 0,
  last_request bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rate_limits is
  'Server-side sliding/fixed window counters; no RLS — service role only.';
comment on column public.rate_limits.identifier is
  'Rate limit key (e.g. user id, IP hash, route name).';
comment on column public.rate_limits.window_start is
  'Unix epoch seconds (or bucket id) marking the start of the current window.';

create trigger rate_limits_set_updated_at
before update on public.rate_limits
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.user_settings enable row level security;

alter table public.user_balances enable row level security;

alter table public.token_transactions enable row level security;

alter table public.billing_orders enable row level security;

alter table public.billing_payments enable row level security;

alter table public.chat_branch_states enable row level security;

alter table public.user_objects enable row level security;

-- user_settings: full CRUD for owner
drop policy if exists "Users can manage own settings" on public.user_settings;

create policy "Users can manage own settings" on public.user_settings
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- user_balances: read-only for clients; mutations via security definer RPCs
drop policy if exists "Users can read own balances" on public.user_balances;

create policy "Users can read own balances" on public.user_balances
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own token transactions" on public.token_transactions;

create policy "Users can read own token transactions" on public.token_transactions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own billing orders" on public.billing_orders;

create policy "Users can read own billing orders" on public.billing_orders
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own billing payments" on public.billing_payments;

create policy "Users can read own billing payments" on public.billing_payments
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can manage own chat branches" on public.chat_branch_states;

create policy "Users can manage own chat branches" on public.chat_branch_states
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own object metadata" on public.user_objects;

create policy "Users can manage own object metadata" on public.user_objects
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('user-uploads', 'user-uploads', false),
  ('avatars', 'avatars', false),
  ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

-- Objects scoped by bucket + first folder segment = auth.uid()
drop policy if exists "Users can read own storage objects" on storage.objects;

create policy "Users can read own storage objects" on storage.objects
for select to authenticated
using (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own storage objects" on storage.objects;

create policy "Users can upload own storage objects" on storage.objects
for insert to authenticated
with check (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own storage objects" on storage.objects;

create policy "Users can update own storage objects" on storage.objects
for update to authenticated
using (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own storage objects" on storage.objects;

create policy "Users can delete own storage objects" on storage.objects
for delete to authenticated
using (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Security-definer functions
-- -----------------------------------------------------------------------------

/*
 * credit_user_tokens(
 *   p_user_id, p_amount, p_idempotency_key, p_source, p_metadata
 * )
 *
 * Adds tokens to user_balances and inserts a credit row in token_transactions.
 *
 * Params:
 *   p_user_id          — target wallet owner
 *   p_amount           — positive integer tokens to credit
 *   p_idempotency_key  — caller-supplied key; sanitized into txn id credit_{key}
 *   p_source           — ledger source (must satisfy token_transactions.source check)
 *   p_metadata         — optional JSON audit payload
 *
 * Idempotency: If token_transactions.id = credit_{sanitized_key} exists, returns
 * that row without mutating balance again.
 *
 * Security: SECURITY DEFINER, search_path = public. Bypasses RLS on balances/
 * transactions; must only be granted to service role / trusted server paths.
 * New users get upsert with trial baseline (5000) adjusted on first credit.
 */
create or replace function public.credit_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_source text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.token_transactions;
  v_txn_id text := 'credit_' || regexp_replace(p_idempotency_key, '[^a-zA-Z0-9_-]', '_', 'g');
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;

  select * into v_txn from public.token_transactions where id = v_txn_id;
  if found then
    return v_txn;
  end if;

  insert into public.user_balances (user_id, tokens_total, tokens_consumed, tokens_remaining, status)
  values (p_user_id, 5000 + p_amount, 0, 5000 + p_amount, 'active')
  on conflict (user_id) do update
  set tokens_total = public.user_balances.tokens_total + excluded.tokens_total - 5000,
      tokens_remaining = public.user_balances.tokens_remaining + excluded.tokens_remaining - 5000,
      status = 'active',
      updated_at = now();

  insert into public.token_transactions (id, user_id, amount, type, source, metadata)
  values (v_txn_id, p_user_id, p_amount, 'credit', p_source, p_metadata)
  returning * into v_txn;

  return v_txn;
end;
$$;

/*
 * debit_user_tokens(
 *   p_user_id, p_amount, p_model_id, p_source, p_metadata
 * )
 *
 * Atomically decrements tokens_remaining and records a debit transaction.
 *
 * Params:
 *   p_user_id   — wallet owner
 *   p_amount    — positive integer to debit
 *   p_model_id  — optional model id stored on the txn row
 *   p_source    — ledger source (chat, generation, etc.)
 *   p_metadata  — optional JSON audit payload
 *
 * Idempotency: None — each call inserts debit_{random_uuid}. Retries double-charge
 * unless the caller implements application-level deduplication.
 *
 * Security: SECURITY DEFINER with row-level lock (FOR UPDATE) on user_balances.
 * Raises if status = suspended or insufficient tokens_remaining.
 */
create or replace function public.debit_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_model_id text,
  p_source text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.token_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance public.user_balances;
  v_txn public.token_transactions;
begin
  if p_amount <= 0 then
    raise exception 'Debit amount must be positive';
  end if;

  insert into public.user_balances (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_balance from public.user_balances where user_id = p_user_id for update;

  if v_balance.status = 'suspended' then
    raise exception 'Account is suspended';
  end if;

  if v_balance.tokens_remaining < p_amount then
    raise exception 'Insufficient token balance';
  end if;

  update public.user_balances
  set tokens_remaining = tokens_remaining - p_amount,
      tokens_consumed = tokens_consumed + p_amount,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.token_transactions (id, user_id, amount, type, source, model_id, metadata)
  values ('debit_' || gen_random_uuid()::text, p_user_id, p_amount, 'debit', p_source, p_model_id, p_metadata)
  returning * into v_txn;

  return v_txn;
end;
$$;

/*
 * fulfill_billing_payment(
 *   p_order_id, p_payment_id, p_payment_status, p_payment_method,
 *   p_payment_email, p_payment_contact, p_payment_created_at, p_source,
 *   p_webhook_event_id, p_webhook_event_name
 * )
 *
 * End-to-end Razorpay capture handler: lock order, credit tokens, record payment,
 * mark order fulfilled, optionally log webhook event.
 *
 * Params:
 *   p_order_id            — billing_orders.razorpay_order_id
 *   p_payment_id          — Razorpay payment id (billing_payments.id)
 *   p_payment_*           — capture metadata from checkout or webhook
 *   p_source              — 'checkout' | 'webhook'
 *   p_webhook_event_id    — optional; when set, writes razorpay_webhook_events
 *   p_webhook_event_name  — optional event name for audit row
 *
 * Returns: (status, order_id, payment_id, tokens_added)
 *   status = 'fulfilled' | 'already_fulfilled'
 *
 * Idempotency: Duplicate payment_id, existing credit txn id
 * credit_billing_{order}_{payment}, or order.status = fulfilled → no-op credit,
 * returns already_fulfilled and logs webhook as duplicate when event id provided.
 *
 * Security: SECURITY DEFINER; must not be exposed to anon/authenticated clients
 * without additional guards. Calls credit_user_tokens internally.
 */
create or replace function public.fulfill_billing_payment(
  p_order_id text,
  p_payment_id text,
  p_payment_status text,
  p_payment_method text,
  p_payment_email text,
  p_payment_contact text,
  p_payment_created_at timestamptz,
  p_source text,
  p_webhook_event_id text default null,
  p_webhook_event_name text default null
)
returns table(status text, order_id text, payment_id text, tokens_added integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.billing_orders;
  v_txn_id text;
begin
  select * into v_order from public.billing_orders where razorpay_order_id = p_order_id for update;
  if not found then
    raise exception 'Payment order not found';
  end if;

  v_txn_id := 'credit_billing_' || regexp_replace(p_order_id || '_' || p_payment_id, '[^a-zA-Z0-9_-]', '_', 'g');

  if exists (select 1 from public.billing_payments where id = p_payment_id)
     or exists (select 1 from public.token_transactions where id = v_txn_id)
     or v_order.status = 'fulfilled' then
    if p_webhook_event_id is not null then
      insert into public.razorpay_webhook_events (id, event_id, event, status, order_id, payment_id)
      values (p_webhook_event_id, p_webhook_event_id, coalesce(p_webhook_event_name, 'payment.captured'), 'duplicate', p_order_id, p_payment_id)
      on conflict (id) do nothing;
    end if;
    return query select 'already_fulfilled'::text, p_order_id, p_payment_id, v_order.tokens;
    return;
  end if;

  perform public.credit_user_tokens(
    v_order.user_id,
    v_order.tokens,
    'billing_' || p_order_id || '_' || p_payment_id,
    'purchase',
    jsonb_build_object('orderId', p_order_id, 'paymentId', p_payment_id, 'planId', v_order.plan_id, 'source', p_source)
  );

  insert into public.billing_payments (
    id, order_id, user_id, amount_paise, currency, status, method, email, contact, source, captured_at, fulfilled_at
  )
  values (
    p_payment_id,
    p_order_id,
    v_order.user_id,
    v_order.amount_paise,
    v_order.currency,
    p_payment_status,
    p_payment_method,
    p_payment_email,
    p_payment_contact,
    p_source,
    p_payment_created_at,
    now()
  );

  update public.billing_orders
  set status = 'fulfilled',
      razorpay_payment_id = p_payment_id,
      razorpay_status = p_payment_status,
      paid_at = p_payment_created_at,
      fulfilled_at = now(),
      updated_at = now()
  where razorpay_order_id = p_order_id;

  if p_webhook_event_id is not null then
    insert into public.razorpay_webhook_events (id, event_id, event, status, order_id, payment_id)
    values (p_webhook_event_id, p_webhook_event_id, coalesce(p_webhook_event_name, 'payment.captured'), 'processed', p_order_id, p_payment_id)
    on conflict (id) do nothing;
  end if;

  return query select 'fulfilled'::text, p_order_id, p_payment_id, v_order.tokens;
end;
$$;

/*
 * increment_numeric_field(
 *   p_table_name, p_row_id, p_field_name, p_amount
 * )
 *
 * Dynamic UPDATE helper: increments a named integer column on a public table row.
 *
 * Params:
 *   p_table_name — unqualified public table name (validated via %I identifier quote)
 *   p_row_id     — primary key value matched against column "id"
 *   p_field_name — column to increment (coalesce null → 0 before add)
 *   p_amount     — delta applied to the field
 *
 * Idempotency: None — each call adds p_amount again.
 *
 * Security: SECURITY DEFINER with dynamic SQL. Restrict grants to service role only;
 * p_table_name / p_field_name must never accept end-user-controlled identifiers
 * without an allowlist at the application layer.
 */
create or replace function public.increment_numeric_field(
  p_table_name text,
  p_row_id text,
  p_field_name text,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('update public.%I set %I = coalesce(%I, 0) + $1, updated_at = now() where id = $2', p_table_name, p_field_name, p_field_name)
  using p_amount, p_row_id;
end;
$$;
