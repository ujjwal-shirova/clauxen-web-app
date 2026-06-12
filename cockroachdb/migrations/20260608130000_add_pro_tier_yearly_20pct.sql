-- Pro tier at ₹4,999; 20% yearly discount on Go/Plus/Pro; Max remains monthly-only
insert into public.plans (
  id, name, display_name, price_paise_monthly, price_paise_yearly, currency,
  token_grant, limits, features, yearly_supported, giftable, sort_order, billing_metadata
)
values
  ('go', 'Go plan', 'Go', 9900, 95000, 'INR', 200000,
   '{"monthlyMessages":1000,"storageGb":5,"tier":"go"}'::jsonb,
   '["chat","artifacts","web_search","uploads","voice"]'::jsonb, true, true, 20,
   '{"description":"Keep chatting with expanded access","monthlyTokens":200000,"yearlyDiscount":0.2}'::jsonb),
  ('plus', 'Plus plan', 'Plus', 199900, 1919000, 'INR', 2000000,
   '{"monthlyMessages":5000,"storageGb":25,"tier":"plus"}'::jsonb,
   '["chat","artifacts","research","image_generation","premium_models","priority","code","projects"]'::jsonb, true, true, 25,
   '{"description":"Unlock the full experience","monthlyTokens":2000000,"yearlyDiscount":0.2}'::jsonb),
  ('pro', 'Pro plan', 'Pro', 499900, 4799000, 'INR', 1000000,
   '{"monthlyMessages":15000,"storageGb":50,"tier":"pro"}'::jsonb,
   '["chat","artifacts","research","image_generation","premium_models","priority","code","projects","cowork"]'::jsonb, true, true, 30,
   '{"description":"Research, code, and organize at scale","monthlyTokens":1000000,"yearlyDiscount":0.2}'::jsonb),
  ('max5x', 'Max 5x', 'Max 5x', 999900, 0, 'INR', 10000000,
   '{"monthlyMessages":25000,"storageGb":100,"tier":"max","multiplier":"5x"}'::jsonb,
   '["chat","artifacts","deep_research","premium_models","highest_priority","creative_generation","code"]'::jsonb, false, true, 40,
   '{"description":"Max 5x usage compared with Pro","monthlyTokens":10000000}'::jsonb),
  ('max20x', 'Max 20x', 'Max 20x', 1999900, 0, 'INR', 40000000,
   '{"monthlyMessages":100000,"storageGb":250,"tier":"max","multiplier":"20x"}'::jsonb,
   '["chat","artifacts","deep_research","premium_models","highest_priority","creative_generation","code","batch_work"]'::jsonb, false, true, 50,
   '{"description":"Max 20x usage compared with Pro","monthlyTokens":40000000}'::jsonb)
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
