import { AppError } from "@/backend/db/errors"; // domain errors — invalid billing inputs reject before DB
import { query, queryOne } from "@/backend/db/pool"; // parameterized SQL helpers — billing tables access

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new AppError(`Invalid ${field}.`, 400, "bad_request");
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new AppError(`Invalid ${field}.`, 400, "bad_request");
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new AppError(`Invalid ${field}.`, 400, "bad_request");
  }
}

// single active plan by id — checkout UI pricing details fetch
export async function getBillingOrderById(orderId: string) {
  return queryOne<{
    id: string;
    user_id: string;
    razorpay_order_id: string;
    amount_paise: number;
    currency: string;
    razorpay_status: string;
  }>(
    `select id, user_id, razorpay_order_id, amount_paise, currency, razorpay_status
     from public.billing_orders
     where id = $1
     limit 1`,
    [orderId],
  );
}

export async function getBillingOrderByRazorpayId(razorpayOrderId: string) {
  return queryOne<{
    id: string;
    user_id: string;
    razorpay_order_id: string;
    amount_paise: number;
    currency: string;
    status: string;
  }>(
    `select id, user_id, razorpay_order_id, amount_paise, currency, status
     from public.billing_orders
     where razorpay_order_id = $1
     limit 1`,
    [razorpayOrderId],
  );
}

export async function getBillingOrderDetailsByRazorpayId(
  razorpayOrderId: string,
) {
  return queryOne<{
    id: string;
    razorpay_order_id: string;
    user_id: string;
    user_email: string | null;
    plan_id: string;
    plan_name: string;
    billing_cycle: string;
    max_tier: string | null;
    subtotal_paise: number;
    tax_paise: number;
    amount_paise: number;
    currency: string;
    paid_at: string | null;
    fulfilled_at: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `select id, razorpay_order_id, user_id, user_email, plan_id, plan_name,
            billing_cycle, max_tier, subtotal_paise, tax_paise, amount_paise,
            currency, paid_at, fulfilled_at, metadata
     from public.billing_orders
     where razorpay_order_id = $1
     limit 1`,
    [razorpayOrderId],
  );
}

export async function getBillingPaymentById(paymentId: string) {
  return queryOne<{
    id: string;
    order_id: string;
    user_id: string;
    method: string | null;
    status: string;
    amount_paise: number;
    captured_at: string | null;
    provider_payload: Record<string, unknown> | null;
  }>(
    `select id, order_id, user_id, method, status, amount_paise, captured_at, provider_payload
     from public.billing_payments
     where id = $1
     limit 1`,
    [paymentId],
  );
}

export async function attachInvoicePdfToPayment(
  paymentId: string,
  input: {
    r2Key: string;
    invoiceNumber: string;
    salesKey?: string | null;
    razorpayDocumentId?: string | null;
    razorpayDocumentPurpose?: string | null;
  },
) {
  await query(
    `update public.billing_payments
     set provider_payload = coalesce(provider_payload, '{}'::jsonb) || $2::jsonb
     where id = $1`,
    [
      paymentId,
      JSON.stringify({
        invoicePdfKey: input.r2Key,
        invoiceSalesKey: input.salesKey ?? undefined,
        invoiceNumber: input.invoiceNumber,
        invoiceGeneratedAt: new Date().toISOString(),
        razorpayInvoiceDocumentId: input.razorpayDocumentId ?? undefined,
        razorpayInvoiceDocumentPurpose:
          input.razorpayDocumentPurpose ?? undefined,
      }),
    ],
  );
}

export async function syncBillingOrderRazorpayId(
  orderId: string,
  razorpayOrderId: string,
) {
  assertNonEmpty(orderId, "order id");
  assertNonEmpty(razorpayOrderId, "razorpay order id");

  await query(
    `update public.billing_orders
     set razorpay_order_id = $2, updated_at = now()
     where id = $1`,
    [orderId, razorpayOrderId],
  );
}

export async function getPlanById(planId: string) {
  return queryOne<{
    id: string;
    name: string;
    display_name: string;
    price_paise_monthly: number;
    price_paise_yearly: number;
    currency: string;
    token_grant: number;
    giftable: boolean;
    yearly_supported: boolean;
  }>(
    `select id, name, display_name, price_paise_monthly, price_paise_yearly, currency,
            token_grant, giftable, yearly_supported
     from public.plans where id = $1 and is_active = true`,
    [planId],
  );
}

export async function listPlans() {
  return query<{
    id: string;
    name: string;
    display_name: string;
    price_paise_monthly: number;
    price_paise_yearly: number;
    currency: string;
    token_grant: number;
    features: unknown;
  }>(
    `select id, name, display_name, price_paise_monthly, price_paise_yearly, currency, token_grant, features
     from public.plans where is_active = true order by price_paise_monthly asc`,
  );
}

export async function getUserSubscription(userId: string) {
  return queryOne<{
    id: string;
    plan_id: string | null;
    status: string;
    billing_cycle: string | null;
    current_period_end: string | null;
  }>(
    `select id, plan_id, status, billing_cycle, current_period_end
     from public.subscriptions
     where user_id = $1
     order by created_at desc
     limit 1`,
    [userId],
  );
}

export async function getUserBalance(userId: string) {
  return queryOne<{
    tokens_remaining: number;
    tokens_total: number;
    status: string;
  }>(
    `select tokens_remaining, tokens_total, status from public.user_balances where user_id = $1`, // one row per user
    [userId],
  );
}

export async function createBillingOrder(input: {
  id: string;
  razorpayOrderId: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  billingCycle: string;
  maxTier?: string | null;
  subtotalPaise: number;
  taxPaise: number;
  amountPaise: number;
  tokens: number;
  receipt: string;
  orderKind?: "subscription" | "gift";
  giftId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  assertNonEmpty(input.id, "order id");
  assertNonEmpty(input.razorpayOrderId, "payment order id");
  assertNonEmpty(input.userId, "user id");
  assertNonEmpty(input.planId, "plan id");
  assertNonNegativeInteger(input.subtotalPaise, "subtotal");
  assertNonNegativeInteger(input.taxPaise, "tax");
  assertNonNegativeInteger(input.amountPaise, "amount");
  assertNonNegativeInteger(input.tokens, "tokens");

  return queryOne<{ id: string; razorpay_order_id: string }>(
    `insert into public.billing_orders (
       id, razorpay_order_id, user_id, user_email, plan_id, plan_name, billing_cycle,
       max_tier, subtotal_paise, tax_paise, amount_paise, tokens, receipt, razorpay_status,
       order_kind, gift_id, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'created',$14,$15,$16::jsonb)
     returning id, razorpay_order_id`,
    [
      input.id,
      input.razorpayOrderId,
      input.userId,
      input.userEmail,
      input.planId,
      input.planName,
      input.billingCycle,
      input.maxTier ?? null,
      input.subtotalPaise,
      input.taxPaise,
      input.amountPaise,
      input.tokens,
      input.receipt,
      input.orderKind ?? "subscription",
      input.giftId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function cancelActiveSubscription(userId: string) {
  return queryOne<{
    id: string;
    plan_id: string | null;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  }>(
    `update public.subscriptions
     set cancel_at_period_end = true,
         status = case when status in ('active', 'trialing', 'past_due') then 'active' else status end,
         metadata = metadata || jsonb_build_object('cancelRequestedAt', now()::text),
         updated_at = now()
     where id = (
       select id from public.subscriptions
       where user_id = $1 and status in ('active', 'trialing', 'past_due')
       order by created_at desc
       limit 1
     )
     returning id, plan_id, status, cancel_at_period_end, current_period_end`,
    [userId],
  );
}

// inference/chat usage — DB function debit_user_tokens atomic deduct + ledger entry
export async function debitUserTokens(input: {
  userId: string;
  amount: number;
  modelId: string;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `select public.debit_user_tokens($1, $2, $3, $4, $5::jsonb)`, // side-effect function — balance mutate inside SQL
    [
      input.userId,
      input.amount,
      input.modelId,
      input.source,
      JSON.stringify(input.metadata ?? {}), // empty object — metadata column valid jsonb
    ],
  );
  return queryOne<{ tokens_remaining: number }>(
    `select tokens_remaining from public.user_balances where user_id = $1`,
    [input.userId],
  );
}

// per-request model usage telemetry — tokens, latency, provider audit trail
export async function recordModelUsage(input: {
  userId: string;
  workspaceId: string | null;
  chatId: string;
  messageId: string | null;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}) {
  // message_id is uuid; ignore optimistic temp-* / non-uuid client ids.
  const messageId =
    input.messageId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.messageId,
    )
      ? input.messageId
      : null;

  const rows = await query<{ record_model_usage: string }>(
    `select public.record_model_usage($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as record_model_usage`, // returns usage row id
    [
      input.userId,
      input.workspaceId,
      input.chatId,
      messageId,
      input.provider,
      input.modelId,
      input.inputTokens,
      input.outputTokens,
      input.latencyMs,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rows[0]?.record_model_usage ?? null; // first row id — function single result expect
}

export async function listInvoices(userId: string) {
  return query<{
    id: string;
    order_id: string;
    amount_paise: number;
    status: string;
    created_at: string;
  }>(
    `select id, order_id, amount_paise, status, created_at
     from public.billing_payments
     where user_id = $1
     order by created_at desc
     limit 50`,
    [userId],
  );
}

export async function fulfillPayment(input: {
  orderId: string;
  paymentId: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentEmail?: string;
  paymentContact?: string;
  amountPaise?: number | null;
  currency?: string;
  source: string;
  webhookEventId?: string;
  webhookEventName?: string;
  providerPayload?: Record<string, unknown>;
}) {
  const rows = await query<{ status: string }>(
    `select status from public.fulfill_billing_payment(
       $1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12::jsonb
     ) limit 1`,
    [
      input.orderId,
      input.paymentId,
      input.paymentStatus,
      input.paymentMethod ?? "card",
      input.paymentEmail ?? "",
      input.paymentContact ?? "",
      input.source,
      input.webhookEventId ?? null,
      input.webhookEventName ?? null,
      input.amountPaise ?? null,
      input.currency ?? "INR",
      JSON.stringify(input.providerPayload ?? {}),
    ],
  );
  return rows[0] ?? null;
}
