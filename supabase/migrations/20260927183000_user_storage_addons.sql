-- Storage add-ons on top of the plan allowance.
-- Included quota is derived in the app from the subscription plan:
--   Free 1 GB, Go 10 GB, Pro 25 GB, Max 50 GB.
-- Extra gigabytes are purchased at $0.026/GB and charged in INR paise.
-- Writes happen only from the application database role. Authenticated
-- clients may read their own rows through the Data API.

create table if not exists public.user_storage_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  extra_gb integer not null default 0
    check (extra_gb >= 0 and extra_gb <= 100000),
  updated_at timestamptz not null default now()
);

comment on table public.user_storage_balances is
  'Purchased storage add-on balance, in whole gigabytes, on top of the plan allowance.';

create table if not exists public.storage_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  gigabytes integer not null check (gigabytes >= 1 and gigabytes <= 10000),
  amount_paise integer not null check (amount_paise >= 100),
  amount_usd_micros integer not null check (amount_usd_micros > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

comment on table public.storage_purchases is
  'One row per storage add-on checkout. extra_gb increases only after a captured payment.';
comment on column public.storage_purchases.amount_usd_micros is
  'List price in millionths of a USD (26000 = $0.026 per GB). The charge itself is amount_paise.';

create unique index if not exists storage_purchases_razorpay_order_uidx
  on public.storage_purchases (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists storage_purchases_razorpay_payment_uidx
  on public.storage_purchases (razorpay_payment_id)
  where razorpay_payment_id is not null;

create index if not exists storage_purchases_user_created_idx
  on public.storage_purchases (user_id, created_at desc);

drop trigger if exists user_storage_balances_set_updated_at on public.user_storage_balances;
create trigger user_storage_balances_set_updated_at
before update on public.user_storage_balances
for each row execute function public.set_updated_at();

alter table public.user_storage_balances enable row level security;
alter table public.storage_purchases enable row level security;

drop policy if exists user_storage_balances_select_own on public.user_storage_balances;
create policy user_storage_balances_select_own
  on public.user_storage_balances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists storage_purchases_select_own on public.storage_purchases;
create policy storage_purchases_select_own
  on public.storage_purchases
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.user_storage_balances to authenticated;
grant select on public.storage_purchases to authenticated;
grant all on table public.user_storage_balances to postgres, service_role;
grant all on table public.storage_purchases to postgres, service_role;
