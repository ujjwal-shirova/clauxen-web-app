-- =============================================================================
-- Migration: 20260930000000_gift_checkout_production
-- Purpose: Production-hardened gift checkout flow.
--   1. Allow billing_orders.tokens = 0 for gift orders (purchaser gets no
--      tokens; redeemer gets gift token_grant). Fixes "database error
--      occurred" on gift checkout (tokens > 0 CHECK violation).
--   2. Reactivate Go plan for gifting + align token_grant with app catalog
--      (src/shared/lib/plans-catalog.ts PLAN_TOKEN_GRANTS).
--   3. 20-character unambiguous gift codes (post-payment rotation).
--   4. Pending gifts expire after 24h; purchased gifts expire after 1 year.
--   5. Idempotent post-payment code rotation flag (code_rotated_at).
-- Prerequisites: 20260507183000_billing_gifts_hardening,
--   20260730120000_gift_claim_flow, 20260922183000_pro_max_plans_only
-- Apply-time behavior: DDL + backfill only; no data loss.
-- Rollback guidance: drop new function/columns; restore tokens CHECK > 0 only
--   after confirming no gift orders with tokens = 0 exist.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. billing_orders.tokens: allow 0 (gift orders grant nothing to purchaser)
-- -----------------------------------------------------------------------------
do $$
declare
  v_constraint text;
begin
  -- Drop any CHECK constraint enforcing tokens > 0 (auto-named variants).
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'billing_orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%tokens%'
      and pg_get_constraintdef(con.oid) ilike '%> 0%'
  loop
    execute format('alter table public.billing_orders drop constraint if exists %I', v_constraint);
  end loop;

  -- Fallback: known inline-check names across environments.
  alter table public.billing_orders drop constraint if exists billing_orders_tokens_check;
  alter table public.billing_orders drop constraint if exists billing_orders_tokens_check1;

  -- Re-add as >= 0 (idempotent).
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'billing_orders'
      and con.conname = 'billing_orders_tokens_nonnegative'
  ) then
    alter table public.billing_orders
      add constraint billing_orders_tokens_nonnegative check (tokens >= 0);
  end if;
end $$;

comment on column public.billing_orders.tokens is
  'Token bundle granted on fulfillment. Gift orders record the plan grant (redeemer gets gift_codes.token_grant via redemption); subscription orders store the plan grant credited to purchaser.';

-- -----------------------------------------------------------------------------
-- 2. Plan catalog: reactivate Go for gifting + align token grants with app
-- -----------------------------------------------------------------------------
-- Go was deactivated by 20260922183000 but the gift UI still sells it.
update public.plans
set
  name = 'Go plan',
  display_name = 'Go',
  price_paise_monthly = 39900,
  price_paise_yearly = 383000,
  currency = 'INR',
  token_grant = 50000,
  yearly_supported = true,
  giftable = true,
  is_active = true,
  sort_order = 20,
  billing_metadata = coalesce(billing_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'description', 'Keep chatting with expanded access',
      'monthlyTokens', 50000,
      'yearlyDiscount', 0.2
    ),
  updated_at = now()
where id = 'go';

-- Align purchasable plan token grants with PLAN_TOKEN_GRANTS catalog.
update public.plans set token_grant = 1000000, updated_at = now() where id = 'pro';
update public.plans set token_grant = 2000000, updated_at = now() where id in ('max', 'max5x');
update public.plans set token_grant = 4000000, updated_at = now() where id = 'max20x';

-- Ensure giftable flags for the gift UI (go, pro, max5x, max20x).
update public.plans
set giftable = true, is_active = true, updated_at = now()
where id in ('go', 'pro', 'max', 'max5x', 'max20x');

-- -----------------------------------------------------------------------------
-- 3. 20-character unambiguous gift codes
-- Alphabet excludes 0/O, 1/I/L for readability. 32 chars => 100 bits entropy.
-- -----------------------------------------------------------------------------
create or replace function public.generate_gift_code_20()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := '';
  v_attempts integer := 0;
  i integer;
begin
  loop
    v_attempts := v_attempts + 1;
    v_bytes := gen_random_bytes(20);
    v_code := '';
    for i in 0..19 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;

    -- Uniqueness against stored hashes (hash is deterministic on normalized input).
    if not exists (
      select 1 from public.gift_codes gc where gc.code_hash = public.hash_gift_code(v_code)
    ) then
      return v_code;
    end if;

    if v_attempts >= 10 then
      raise exception 'Failed to generate unique gift code' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

comment on function public.generate_gift_code_20() is
  'Generates a unique 20-character unambiguous gift code (ABCDEFGHJKMNPQRSTUVWXYZ23456789). Returns plaintext; caller must hash via hash_gift_code() before insert. Retries on hash collision.';

-- Keep legacy generator for backward compatibility (existing pending gifts).
-- New purchases MUST use generate_gift_code_20().

-- -----------------------------------------------------------------------------
-- 4. Post-payment rotation flag (idempotency for finalize-after-capture)
-- -----------------------------------------------------------------------------
alter table public.gift_codes
  add column if not exists code_rotated_at timestamptz;

comment on column public.gift_codes.code_rotated_at is
  'Set when the final 20-char code is minted after Razorpay capture. Null = placeholder/pre-payment code. Rotation runs once (FOR UPDATE lock); repeats are no-ops.';

create index if not exists gift_codes_rotation_idx
  on public.gift_codes (status, code_rotated_at)
  where status = 'purchased' and code_rotated_at is null;

-- -----------------------------------------------------------------------------
-- 5. Expiry semantics: pending 24h, purchased 1 year
-- -----------------------------------------------------------------------------
create or replace function public.expire_old_gift_codes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_pending integer := 0;
  v_purchased integer := 0;
begin
  -- Pending (unpaid) gifts: expire 24h after creation so stale checkouts
  -- cannot be paid late. Status -> expired (claim + redeem both reject).
  update public.gift_codes gc
  set status = 'expired', updated_at = now()
  where gc.status = 'pending_payment'
    and gc.created_at < now() - interval '24 hours';

  get diagnostics v_pending = row_count;

  -- Purchased (paid, unclaimed) gifts: expire at expires_at (1 year after
  -- purchase; see fulfill_billing_payment greatest(expires_at, now()+1yr)).
  update public.gift_codes gc
  set status = 'expired', updated_at = now()
  where gc.status = 'purchased'
    and gc.expires_at <= now();

  get diagnostics v_purchased = row_count;

  v_count := v_pending + v_purchased;
  return v_count;
end;
$$;

comment on function public.expire_old_gift_codes() is
  'Marks pending_payment gifts older than 24h and purchased gifts past expires_at as expired. Returns rows updated. Invoked by pg_cron operational maintenance (every 30m) and inline on gift reads/redeems.';

revoke all on function public.expire_old_gift_codes() from public, anon, authenticated;
grant execute on function public.expire_old_gift_codes() to service_role;

revoke all on function public.generate_gift_code_20() from public, anon, authenticated;
grant execute on function public.generate_gift_code_20() to service_role;

-- -----------------------------------------------------------------------------
-- 6. Purchased-gift expiry index (already exists in perf hardening; ensure)
-- -----------------------------------------------------------------------------
create index if not exists gift_codes_purchased_expiry_idx
  on public.gift_codes (status, expires_at, id)
  where status in ('purchased', 'pending_payment');
