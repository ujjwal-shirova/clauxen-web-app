-- Sell only Pro (₹1,999 / month) and Max. Retired plan rows stay so existing
-- subscriptions, gifts, and workspace plan_id foreign keys remain valid.

update public.plans
set
  is_active = false,
  giftable = false,
  updated_at = now()
where id not in ('pro', 'max', 'max5x', 'max20x');

update public.plans
set
  name = 'Pro plan',
  display_name = 'Pro',
  price_paise_monthly = 199900,
  price_paise_yearly = 1919000,
  yearly_supported = true,
  giftable = true,
  is_active = true,
  sort_order = 10,
  billing_metadata = (coalesce(billing_metadata, '{}'::jsonb) - 'deprecated' - 'replacedBy')
    || jsonb_build_object(
      'description', 'Research, code, and organize at scale',
      'monthlyTokens', 1000000,
      'yearlyDiscount', 0.2
    ),
  updated_at = now()
where id = 'pro';

update public.plans
set
  is_active = true,
  giftable = true,
  updated_at = now()
where id in ('max', 'max5x', 'max20x');
