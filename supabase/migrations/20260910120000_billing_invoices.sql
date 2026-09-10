-- Billing invoices ledger.
--
-- Every paid checkout generates exactly one PDF on the Cloudflare billing
-- Worker: PDF bytes → R2 (`clauxen-invoices` bucket) → this row stores the
-- R2 key + download URL → receipt email with the PDF attached.
-- Razorpay payment id is the idempotency key (one invoice per payment).

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null references public.billing_orders(id) on delete cascade,
  payment_id text not null unique references public.billing_payments(id) on delete cascade,
  invoice_number text not null unique,
  kind text not null default 'domestic_gst'
    check (kind in ('domestic_gst', 'export_lut', 'exempt_gstin')),
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  tax_paise integer not null check (tax_paise >= 0),
  total_paise integer not null check (total_paise > 0),
  country text not null default 'IN',
  r2_key text not null,
  r2_url text not null,
  razorpay_document_id text,
  evidence jsonb not null default '{}'::jsonb,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_invoices is
  'One row per paid invoice; PDF lives in Cloudflare R2, this row stores the R2 key + download URL.';
comment on column public.billing_invoices.payment_id is
  'Razorpay payment id; idempotency key — exactly one invoice per payment.';
comment on column public.billing_invoices.kind is
  'domestic_gst (18% GST) | export_lut (zero-rated export under LUT) | exempt_gstin (valid GSTIN, no GST at checkout).';
comment on column public.billing_invoices.evidence is
  'Location evidence snapshot (declared/ip/instrument verdict) backing the tax decision.';

create trigger billing_invoices_set_updated_at
before update on public.billing_invoices
for each row execute function public.set_updated_at();

create index if not exists billing_invoices_user_created_idx
  on public.billing_invoices (user_id, created_at desc);
create index if not exists billing_invoices_order_idx
  on public.billing_invoices (order_id);
create index if not exists billing_invoices_number_idx
  on public.billing_invoices (invoice_number);

alter table public.billing_invoices enable row level security;

create policy billing_invoices_select_own
  on public.billing_invoices for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.billing_invoices to authenticated;
grant all on table public.billing_invoices to postgres, service_role;
