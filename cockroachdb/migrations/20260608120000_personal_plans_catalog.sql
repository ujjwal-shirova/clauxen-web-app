-- Personal plan catalog sync: Go ₹99, Plus ₹1,999, Max 5x ₹9,999, Max 20x ₹19,999
insert into public.plans (
  id, name, display_name, price_paise_monthly, price_paise_yearly, currency,
  token_grant, limits, features, yearly_supported, giftable, sort_order, billing_metadata
)
values
  ('go', 'Go plan', 'Go', 9900, 98600, 'INR', 200000,
   '{"monthlyMessages":1000,"storageGb":5,"tier":"go"}'::jsonb,
   '["chat","artifacts","web_search","uploads","voice"]'::jsonb, true, true, 20,
   '{"description":"Keep chatting with expanded access","monthlyTokens":200000,"yearlyDiscount":0.17}'::jsonb),
  ('plus', 'Plus plan', 'Plus', 199900, 1989000, 'INR', 2000000,
   '{"monthlyMessages":5000,"storageGb":25,"tier":"plus"}'::jsonb,
   '["chat","artifacts","research","image_generation","premium_models","priority","code","projects"]'::jsonb, true, true, 25,
   '{"description":"Unlock the full experience","monthlyTokens":2000000,"yearlyDiscount":0.17}'::jsonb),
  ('max5x', 'Max 5x', 'Max 5x', 999900, 0, 'INR', 10000000,
   '{"monthlyMessages":25000,"storageGb":100,"tier":"max","multiplier":"5x"}'::jsonb,
   '["chat","artifacts","deep_research","premium_models","highest_priority","creative_generation","code"]'::jsonb, false, true, 40,
   '{"description":"Max 5x usage compared with Plus","monthlyTokens":10000000}'::jsonb),
  ('max20x', 'Max 20x', 'Max 20x', 1999900, 0, 'INR', 40000000,
   '{"monthlyMessages":100000,"storageGb":250,"tier":"max","multiplier":"20x"}'::jsonb,
   '["chat","artifacts","deep_research","premium_models","highest_priority","creative_generation","code","batch_work"]'::jsonb, false, true, 50,
   '{"description":"Max 20x usage for power users","monthlyTokens":40000000}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  display_name = excluded.display_name,
  price_paise_monthly = excluded.price_paise_monthly,
  price_paise_yearly = excluded.price_paise_yearly,
  token_grant = excluded.token_grant,
  limits = excluded.limits,
  features = excluded.features,
  yearly_supported = excluded.yearly_supported,
  giftable = excluded.giftable,
  sort_order = excluded.sort_order,
  billing_metadata = excluded.billing_metadata;

update public.plans
set giftable = false,
    sort_order = 28,
    billing_metadata = coalesce(billing_metadata, '{}'::jsonb) || '{"deprecated":true,"replacedBy":"plus"}'::jsonb
where id = 'pro';
