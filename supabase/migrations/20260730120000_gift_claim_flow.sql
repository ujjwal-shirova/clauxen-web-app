-- Gift claim tokens + do not credit purchaser tokens on gift fulfill + queue delivery.

alter table public.gift_codes
  add column if not exists claim_token text;

create unique index if not exists gift_codes_claim_token_uidx
  on public.gift_codes (claim_token)
  where claim_token is not null;

comment on column public.gift_codes.claim_token is
  'Opaque public claim token for /gift/claim/{token} links. Generated at gift create; distinct from redeem code.';

update public.gift_codes
set claim_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where claim_token is null
  and status in ('pending_payment', 'purchased');

create or replace function public.fulfill_billing_payment(
  p_order_id text,
  p_payment_id text,
  p_payment_status text,
  p_payment_method text,
  p_payment_email text,
  p_payment_contact text,
  p_payment_created_at timestamptz,
  p_source text,
  p_webhook_event_id text default null,
  p_webhook_event_name text default null,
  p_payment_amount_paise integer default null,
  p_payment_currency text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns table(status text, order_id text, payment_id text, tokens_added integer, subscription_id uuid, gift_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.billing_orders;
  v_txn_id text;
  v_workspace_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_subscription_id uuid;
  v_tokens_added integer := 0;
begin
  if p_payment_status <> 'captured' then
    raise exception 'Payment must be captured before fulfillment';
  end if;

  if p_source not in ('checkout', 'webhook') then
    raise exception 'Invalid fulfillment source';
  end if;

  select * into v_order from public.billing_orders where razorpay_order_id = p_order_id for update;
  if not found then
    raise exception 'Payment order not found';
  end if;

  update public.billing_orders
  set verification_attempts = verification_attempts + 1,
      verified_at = now(),
      updated_at = now()
  where razorpay_order_id = p_order_id;

  if p_payment_amount_paise is not null and p_payment_amount_paise <> v_order.amount_paise then
    update public.billing_orders
    set status = 'failed', failure_reason = 'payment_amount_mismatch', updated_at = now()
    where razorpay_order_id = p_order_id;
    raise exception 'Payment amount does not match the order';
  end if;

  if p_payment_currency is not null and upper(p_payment_currency) <> upper(v_order.currency) then
    update public.billing_orders
    set status = 'failed', failure_reason = 'payment_currency_mismatch', updated_at = now()
    where razorpay_order_id = p_order_id;
    raise exception 'Payment currency does not match the order';
  end if;

  v_txn_id := 'credit_billing_' || regexp_replace(p_order_id || '_' || p_payment_id, '[^a-zA-Z0-9_-]', '_', 'g');

  if exists (select 1 from public.billing_payments where id = p_payment_id)
     or exists (select 1 from public.token_transactions where id = v_txn_id)
     or v_order.status = 'fulfilled' then
    if p_webhook_event_id is not null then
      insert into public.razorpay_webhook_events (id, event_id, event, status, order_id, payment_id)
      values (p_webhook_event_id, p_webhook_event_id, coalesce(p_webhook_event_name, 'payment.captured'), 'duplicate', p_order_id, p_payment_id)
      on conflict (id) do nothing;
    end if;

    select id into v_subscription_id
    from public.subscriptions
    where metadata ->> 'billingOrderId' = p_order_id
    order by created_at desc
    limit 1;

    return query select
      'already_fulfilled'::text,
      p_order_id,
      p_payment_id,
      case when v_order.order_kind = 'gift' then 0 else v_order.tokens end,
      v_subscription_id,
      v_order.gift_id;
    return;
  end if;

  perform 1 from public.plans where id = v_order.plan_id and is_active = true;
  if not found then
    raise exception 'Plan is not active';
  end if;

  if v_order.order_kind = 'gift' then
    if v_order.gift_id is null then
      raise exception 'Gift order is missing gift id';
    end if;

    update public.gift_codes gc
    set status = 'purchased',
        billing_order_id = p_order_id,
        purchased_payment_id = p_payment_id,
        purchased_at = now(),
        expires_at = greatest(expires_at, now() + interval '1 year'),
        updated_at = now()
    where gc.id = v_order.gift_id
      and gc.purchaser_user_id = v_order.user_id
      and gc.status = 'pending_payment';

    v_tokens_added := 0;

    begin
      perform public.queue_gift_delivery(v_order.gift_id);
    exception
      when others then
        null;
    end;
  else
    v_period_start := now();
    v_period_end := case
      when v_order.billing_cycle = 'yearly' then v_period_start + interval '1 year'
      else v_period_start + interval '1 month'
    end;

    select default_workspace_id into v_workspace_id
    from public.profiles
    where id = v_order.user_id;

    update public.subscriptions s
    set status = 'superseded',
        cancel_at_period_end = false,
        updated_at = now(),
        metadata = metadata || jsonb_build_object('supersededByOrderId', p_order_id)
    where s.user_id = v_order.user_id
      and coalesce(s.workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(v_order.workspace_id, v_workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and s.status in ('trialing', 'active', 'past_due');

    insert into public.subscriptions (
      user_id, workspace_id, plan_id, provider, provider_subscription_id, status,
      billing_cycle, current_period_start, current_period_end, cancel_at_period_end, metadata
    )
    values (
      v_order.user_id,
      coalesce(v_order.workspace_id, v_workspace_id),
      v_order.plan_id,
      'razorpay',
      p_payment_id,
      'active',
      v_order.billing_cycle,
      v_period_start,
      v_period_end,
      false,
      jsonb_build_object(
        'billingOrderId', p_order_id,
        'paymentId', p_payment_id,
        'planName', v_order.plan_name,
        'maxTier', v_order.max_tier,
        'activatedBy', p_source
      )
    )
    returning id into v_subscription_id;

    update public.workspaces
    set plan_id = v_order.plan_id, updated_at = now()
    where id = coalesce(v_order.workspace_id, v_workspace_id);

    v_tokens_added := v_order.tokens;

    perform public.credit_user_tokens(
      v_order.user_id,
      v_order.tokens,
      'billing_' || p_order_id || '_' || p_payment_id,
      'purchase',
      jsonb_build_object(
        'orderId', p_order_id,
        'paymentId', p_payment_id,
        'planId', v_order.plan_id,
        'planName', v_order.plan_name,
        'orderKind', v_order.order_kind,
        'source', p_source
      )
    );
  end if;

  insert into public.billing_payments (
    id, order_id, user_id, amount_paise, currency, status, method, email, contact,
    source, captured_at, fulfilled_at, provider_payment_id, provider_payload
  )
  values (
    p_payment_id,
    p_order_id,
    v_order.user_id,
    v_order.amount_paise,
    v_order.currency,
    p_payment_status,
    p_payment_method,
    p_payment_email,
    p_payment_contact,
    p_source,
    p_payment_created_at,
    now(),
    p_payment_id,
    coalesce(p_provider_payload, '{}'::jsonb)
  );

  update public.billing_orders
  set status = 'fulfilled',
      razorpay_payment_id = p_payment_id,
      razorpay_status = p_payment_status,
      paid_at = p_payment_created_at,
      fulfilled_at = now(),
      activated_at = now(),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      failure_reason = null,
      updated_at = now()
  where razorpay_order_id = p_order_id;

  insert into public.subscription_activation_events (
    subscription_id, user_id, workspace_id, plan_id, billing_order_id, payment_id,
    source, event_type, period_start, period_end, metadata
  )
  values (
    v_subscription_id,
    v_order.user_id,
    coalesce(v_order.workspace_id, v_workspace_id),
    v_order.plan_id,
    p_order_id,
    p_payment_id,
    p_source,
    case when v_order.order_kind = 'gift' then 'gift_purchased' else 'subscription_activated' end,
    v_period_start,
    v_period_end,
    jsonb_build_object('orderKind', v_order.order_kind, 'tokens', v_tokens_added)
  );

  if p_webhook_event_id is not null then
    insert into public.razorpay_webhook_events (id, event_id, event, status, order_id, payment_id)
    values (p_webhook_event_id, p_webhook_event_id, coalesce(p_webhook_event_name, 'payment.captured'), 'processed', p_order_id, p_payment_id)
    on conflict (id) do nothing;
  end if;

  return query select 'fulfilled'::text, p_order_id, p_payment_id, v_tokens_added, v_subscription_id, v_order.gift_id;
end;
$$;

revoke all on function public.fulfill_billing_payment(
  text, text, text, text, text, text, timestamptz, text, text, text, integer, text, jsonb
) from public, anon, authenticated;

grant execute on function public.fulfill_billing_payment(
  text, text, text, text, text, text, timestamptz, text, text, text, integer, text, jsonb
) to service_role;
