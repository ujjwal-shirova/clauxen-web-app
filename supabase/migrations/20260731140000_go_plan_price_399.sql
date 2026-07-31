-- Go plan monthly ₹99 → ₹399; yearly = round(399 * 12 * 0.8) = ₹3,830
update plans
set
  price_paise_monthly = 39900,
  price_paise_yearly = 383000,
  updated_at = now()
where id = 'go';
