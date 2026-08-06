-- Platform hardening: close public trigger-function RPC surfaces and make
-- ownership RLS checks initplan-friendly at production scale.

-- Trigger helpers never need to be callable through the Data API.
revoke execute on function public.bump_user_activity_day() from public, anon, authenticated;
revoke execute on function public.touch_scheduled_tasks_updated_at() from public, anon, authenticated;

-- Evaluate auth.uid() once per query rather than once per scanned row.
drop policy if exists billing_addresses_select_own on public.billing_addresses;
create policy billing_addresses_select_own
  on public.billing_addresses for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists billing_addresses_insert_own on public.billing_addresses;
create policy billing_addresses_insert_own
  on public.billing_addresses for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists billing_addresses_update_own on public.billing_addresses;
create policy billing_addresses_update_own
  on public.billing_addresses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists billing_addresses_delete_own on public.billing_addresses;
create policy billing_addresses_delete_own
  on public.billing_addresses for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own
  on public.payment_methods for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists payment_methods_insert_own on public.payment_methods;
create policy payment_methods_insert_own
  on public.payment_methods for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists payment_methods_update_own on public.payment_methods;
create policy payment_methods_update_own
  on public.payment_methods for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists payment_methods_delete_own on public.payment_methods;
create policy payment_methods_delete_own
  on public.payment_methods for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_activity_days_select_own on public.user_activity_days;
create policy user_activity_days_select_own
  on public.user_activity_days for select to authenticated
  using (user_id = (select auth.uid()));

-- One FOR ALL policy is sufficient; the previous separate SELECT policy made
-- every select evaluate two permissive policies.
drop policy if exists user_clauxen_insights_select_own on public.user_clauxen_insights;
drop policy if exists user_clauxen_insights_upsert_own on public.user_clauxen_insights;
create policy user_clauxen_insights_own
  on public.user_clauxen_insights for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
