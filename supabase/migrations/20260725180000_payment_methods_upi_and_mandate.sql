-- Extend payment_methods for UPI Autopay + card mandate metadata (PCI-safe).

alter table public.payment_methods
  add column if not exists method_type text not null default 'card'
    check (method_type in ('card', 'upi')),
  add column if not exists upi_vpa text,
  add column if not exists display_label text,
  add column if not exists mandate_max_amount_paise integer,
  add column if not exists mandate_status text;

-- UPI rows may omit card digit fields.
alter table public.payment_methods
  alter column card_first4 drop not null,
  alter column card_last4 drop not null;

alter table public.payment_methods
  drop constraint if exists payment_methods_card_first4_check,
  drop constraint if exists payment_methods_card_last4_check;

alter table public.payment_methods
  add constraint payment_methods_card_first4_check
    check (card_first4 is null or card_first4 ~ '^[0-9]{4}$'),
  add constraint payment_methods_card_last4_check
    check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  add constraint payment_methods_upi_or_card_display check (
    (method_type = 'card' and card_first4 is not null and card_last4 is not null)
    or (method_type = 'upi' and (upi_vpa is not null or display_label is not null))
  );

comment on column public.payment_methods.mandate_max_amount_paise is
  'Authorized mandate ceiling in paise (₹25,000 = 2500000). Setup charges ₹0.';
