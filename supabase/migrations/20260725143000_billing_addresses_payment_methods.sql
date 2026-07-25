-- =============================================================================
-- Migration: 20260725143000_billing_addresses_payment_methods
-- Purpose: Persist user billing addresses + tokenized payment methods (PCI-safe).
-- Security:
--   - Never store full PAN. Only first4/last4 display digits + encrypted
--     Razorpay card/token reference.
--   - RLS: owners SELECT/INSERT/UPDATE/DELETE their own rows.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Billing addresses (one active profile per user; history via updated_at)
-- -----------------------------------------------------------------------------
create table if not exists public.billing_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  country_code text not null default 'IN',
  address_line1 text not null,
  address_line2 text not null default '',
  city text not null,
  state text not null,
  postal_code text not null,
  phone text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_addresses_country_len check (char_length(country_code) = 2),
  constraint billing_addresses_name_len check (
    char_length(full_name) between 2 and 120
  ),
  constraint billing_addresses_line1_len check (
    char_length(address_line1) between 3 and 200
  ),
  constraint billing_addresses_city_len check (
    char_length(city) between 2 and 100
  ),
  constraint billing_addresses_state_len check (
    char_length(state) between 2 and 100
  ),
  constraint billing_addresses_postal_len check (
    char_length(postal_code) between 4 and 16
  )
);

create unique index if not exists billing_addresses_one_default_per_user
  on public.billing_addresses (user_id)
  where is_default;

create index if not exists billing_addresses_user_id_idx
  on public.billing_addresses (user_id);

drop trigger if exists billing_addresses_set_updated_at on public.billing_addresses;
create trigger billing_addresses_set_updated_at
  before update on public.billing_addresses
  for each row execute function public.set_updated_at();

alter table public.billing_addresses enable row level security;

drop policy if exists billing_addresses_select_own on public.billing_addresses;
create policy billing_addresses_select_own
  on public.billing_addresses for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists billing_addresses_insert_own on public.billing_addresses;
create policy billing_addresses_insert_own
  on public.billing_addresses for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists billing_addresses_update_own on public.billing_addresses;
create policy billing_addresses_update_own
  on public.billing_addresses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists billing_addresses_delete_own on public.billing_addresses;
create policy billing_addresses_delete_own
  on public.billing_addresses for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.billing_addresses to authenticated;
grant all on public.billing_addresses to service_role;

-- -----------------------------------------------------------------------------
-- Payment methods — tokenized card-on-file (no PAN)
-- -----------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- AES-GCM ciphertext (base64) of Razorpay card_id / token_id — never PAN
  provider_ref_encrypted text not null,
  provider_ref_fingerprint text not null,
  network text not null check (
    network in ('visa', 'mastercard', 'amex', 'rupay', 'jcb', 'discover', 'unknown')
  ),
  brand text not null default '',
  -- Display only: first 4 digits (never more). Full PAN is never stored.
  card_first4 text not null check (card_first4 ~ '^[0-9]{4}$'),
  card_last4 text not null check (card_last4 ~ '^[0-9]{4}$'),
  exp_month smallint check (exp_month is null or (exp_month between 1 and 12)),
  exp_year smallint check (exp_year is null or (exp_year between 2020 and 2100)),
  is_default boolean not null default false,
  razorpay_customer_id text,
  last_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_fingerprint_unique unique (user_id, provider_ref_fingerprint)
);

create unique index if not exists payment_methods_one_default_per_user
  on public.payment_methods (user_id)
  where is_default;

create index if not exists payment_methods_user_id_idx
  on public.payment_methods (user_id);

drop trigger if exists payment_methods_set_updated_at on public.payment_methods;
create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own
  on public.payment_methods for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists payment_methods_insert_own on public.payment_methods;
create policy payment_methods_insert_own
  on public.payment_methods for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists payment_methods_update_own on public.payment_methods;
create policy payment_methods_update_own
  on public.payment_methods for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists payment_methods_delete_own on public.payment_methods;
create policy payment_methods_delete_own
  on public.payment_methods for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;

comment on table public.billing_addresses is
  'User billing address profile used at checkout and on invoices.';
comment on table public.payment_methods is
  'Tokenized card-on-file. Stores encrypted Razorpay refs + first4/last4 only — never full PAN.';
comment on column public.payment_methods.card_first4 is
  'First four digits for UI masking only. Never accept or store more than 4 digits.';
