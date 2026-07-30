import { randomBytes } from "crypto";
import { AppError } from "@/server/db/errors";
import { query, queryOne, withTransaction } from "@/server/db/pool"; // parameterized SQL + atomic txn

const GIFT_CODE_MAX_LEN = 64; // hash input upper bound — oversized redeem attempts reject
const CLAIM_TOKEN_MAX_LEN = 64;

export function generateClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function generateGiftCodePlaintext() {
  const row = await queryOne<{ code: string }>(
    `select public.generate_gift_code() as code`,
  ); // Postgres function
  if (!row?.code) {
    throw new AppError(
      "Failed to generate gift code.",
      500,
      "gift_code_generation_failed",
    ); // function failure — rare infra issue
  }
  return row.code;
}

export async function createGiftCode(input: {
  plainCode: string;
  claimToken: string;
  purchaserUserId: string;
  purchaserEmail: string;
  recipientEmail: string | null;
  recipientName: string | null;
  senderName: string;
  senderEmail: string;
  deliveryMethod: "email" | "link";
  message: string | null;
  themeColor: string | null;
  planId: string;
  planName: string;
  months: number;
  tokenGrant: number;
  subtotalPaise: number;
  taxPaise: number;
  amountPaise: number;
}) {
  if (
    input.plainCode.length < 8 ||
    input.plainCode.length > GIFT_CODE_MAX_LEN
  ) {
    throw new AppError("Invalid gift code.", 500, "gift_code_invalid"); // defense-in-depth — caller must pass DB-generated code
  }
  if (
    !input.claimToken ||
    input.claimToken.length < 16 ||
    input.claimToken.length > CLAIM_TOKEN_MAX_LEN
  ) {
    throw new AppError("Invalid claim token.", 500, "gift_claim_token_invalid");
  }
  const prefix = input.plainCode.slice(0, 7);
  const last4 = input.plainCode.slice(-4);

  return queryOne<{
    id: string;
    code_prefix: string;
    code_last4: string;
    claim_token: string;
  }>(
    `insert into public.gift_codes (
       code_hash, code_prefix, code_last4, claim_token, purchaser_user_id, purchaser_email,
       recipient_email, recipient_name, sender_name, sender_email, delivery_method,
       message, theme_color, plan_id, plan_name, months, token_grant,
       subtotal_paise, tax_paise, amount_paise, status, expires_at
     ) values (
       public.hash_gift_code($1), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending_payment',
       now() + interval '1 year'
     )
     returning id, code_prefix, code_last4, claim_token`,
    [
      input.plainCode, // $1 — hash function input
      prefix,
      last4,
      input.claimToken,
      input.purchaserUserId,
      input.purchaserEmail,
      input.recipientEmail,
      input.recipientName,
      input.senderName,
      input.senderEmail,
      input.deliveryMethod,
      input.message,
      input.themeColor,
      input.planId,
      input.planName,
      input.months,
      input.tokenGrant,
      input.subtotalPaise,
      input.taxPaise,
      input.amountPaise,
    ],
  );
}

export async function linkGiftToOrder(giftId: string, razorpayOrderId: string) {
  await query(
    `update public.gift_codes
     set billing_order_id = $2, updated_at = now()
     where id = $1`,
    [giftId, razorpayOrderId],
  );
}

export type GiftClaimPreview = {
  id: string;
  status: string;
  expires_at: string;
  plan_id: string;
  plan_name: string;
  months: number;
  sender_name: string;
  message: string | null;
  theme_color: string | null;
  delivery_method: "email" | "link";
  recipient_email: string | null;
  purchaser_email: string;
  claim_token: string;
};

export async function getGiftByClaimToken(claimToken: string) {
  const token = claimToken.trim();
  if (!token || token.length > CLAIM_TOKEN_MAX_LEN) {
    throw new AppError("Gift was not found.", 404, "gift_not_found");
  }
  await query(`select public.expire_old_gift_codes()`);
  const gift = await queryOne<GiftClaimPreview>(
    `select id, status, expires_at, plan_id, plan_name, months, sender_name,
            message, theme_color, delivery_method, recipient_email,
            purchaser_email, claim_token
     from public.gift_codes
     where claim_token = $1
     limit 1`,
    [token],
  );
  if (!gift) throw new AppError("Gift was not found.", 404, "gift_not_found");
  return gift;
}

export async function getGiftByIdForPurchaser(giftId: string, userId: string) {
  return queryOne<{
    id: string;
    status: string;
    plan_id: string;
    plan_name: string;
    months: number;
    claim_token: string;
    delivery_method: "email" | "link";
    recipient_email: string | null;
    sender_name: string;
    message: string | null;
    billing_order_id: string | null;
    subtotal_paise: number;
    tax_paise: number;
    amount_paise: number;
  }>(
    `select id, status, plan_id, plan_name, months, claim_token, delivery_method,
            recipient_email, sender_name, message, billing_order_id,
            subtotal_paise, tax_paise, amount_paise
     from public.gift_codes
     where id = $1 and purchaser_user_id = $2
     limit 1`,
    [giftId, userId],
  );
}

export async function getPurchasedGiftForDelivery(giftId: string) {
  return queryOne<{
    id: string;
    status: string;
    plan_name: string;
    months: number;
    claim_token: string;
    delivery_method: "email" | "link";
    recipient_email: string | null;
    purchaser_email: string;
    sender_name: string;
    message: string | null;
    theme_color: string | null;
  }>(
    `select id, status, plan_name, months, claim_token, delivery_method,
            recipient_email, purchaser_email, sender_name, message, theme_color
     from public.gift_codes
     where id = $1
     limit 1`,
    [giftId],
  );
}

export async function queueGiftDelivery(giftId: string) {
  return queryOne<{ id: string }>(
    `select public.queue_gift_delivery($1::uuid) as id`,
    [giftId],
  );
}

export async function markGiftDeliverySent(giftId: string) {
  await query(
    `update public.gift_delivery_jobs
     set status = 'sent', updated_at = now(), sent_at = coalesce(sent_at, now())
     where gift_id = $1`,
    [giftId],
  );
}

type GiftRow = {
  id: string;
  status: string;
  expires_at: string;
  plan_id: string;
  months: number;
  token_grant: number;
  code_prefix: string;
  billing_order_id: string | null;
  purchased_payment_id: string | null;
};

export async function redeemGiftByClaimToken(userId: string, claimToken: string) {
  const gift = await getGiftByClaimToken(claimToken);
  if (gift.status !== "purchased") {
    throw new AppError(
      "Gift is not redeemable.",
      400,
      "gift_not_redeemable",
    );
  }
  if (new Date(gift.expires_at) <= new Date()) {
    throw new AppError("Gift has expired.", 400, "gift_expired");
  }

  // Redeem via code hash path requires plaintext code — claim path uses id lock.
  return withTransaction(async (client) => {
    await client.query(`select public.expire_old_gift_codes()`);

    const giftResult = await client.query<GiftRow>(
      `select id, status, expires_at, plan_id, months, token_grant, code_prefix,
              billing_order_id, purchased_payment_id
       from public.gift_codes
       where claim_token = $1
       for update`,
      [claimToken.trim()],
    );
    const row = giftResult.rows[0];
    if (!row)
      throw new AppError("Gift was not found.", 404, "gift_not_found");
    if (row.status !== "purchased") {
      throw new AppError(
        "Gift is not redeemable.",
        400,
        "gift_not_redeemable",
      );
    }
    if (new Date(row.expires_at) <= new Date()) {
      await client.query(
        `update public.gift_codes set status = 'expired', updated_at = now() where id = $1`,
        [row.id],
      );
      throw new AppError("Gift has expired.", 400, "gift_expired");
    }

    const profileResult = await client.query<{ workspace_id: string | null }>(
      `select default_workspace_id as workspace_id from public.profiles where id = $1`,
      [userId],
    );
    const workspaceId = profileResult.rows[0]?.workspace_id ?? null;
    const nullWorkspace = "00000000-0000-0000-0000-000000000000";

    await client.query(
      `update public.subscriptions s
       set status = 'superseded',
           updated_at = now(),
           metadata = metadata || jsonb_build_object('supersededByGiftId', $3::text)
       where s.user_id = $1
         and coalesce(s.workspace_id, $2::uuid) = coalesce($4::uuid, $2::uuid)
         and s.status in ('trialing', 'active', 'past_due')`,
      [userId, nullWorkspace, row.id, workspaceId],
    );

    const subResult = await client.query<{ id: string }>(
      `insert into public.subscriptions (
         user_id, workspace_id, plan_id, provider, provider_subscription_id, status,
         billing_cycle, current_period_start, current_period_end, cancel_at_period_end, metadata
       ) values (
         $1, $2, $3, 'gift', $4::text, 'active', 'gift', now(),
         now() + make_interval(months => $5::int), true,
         jsonb_build_object('giftId', $4::text, 'giftMonths', $5::int, 'giftCodePrefix', $6::text)
       )
       returning id`,
      [userId, workspaceId, row.plan_id, row.id, row.months, row.code_prefix],
    );
    const subscriptionId = subResult.rows[0]?.id;
    if (!subscriptionId)
      throw new AppError("Failed to create subscription.", 500);

    const creditResult = await client.query<{ id: string }>(
      `select txn.id
       from public.credit_user_tokens(
         $1, $2, $3, 'purchase',
         jsonb_build_object('giftId', $4::uuid, 'planId', $5::text, 'months', $6::int)
       ) as txn`,
      [
        userId,
        row.token_grant,
        `gift_${row.id}`,
        row.id,
        row.plan_id,
        row.months,
      ],
    );
    const tokenTransactionId = creditResult.rows[0]?.id;

    await client.query(
      `update public.gift_codes
       set status = 'redeemed',
           redeemed_at = now(),
           redeemed_by_user_id = $2,
           updated_at = now()
       where id = $1`,
      [row.id, userId],
    );

    await client.query(
      `insert into public.gift_redemptions (gift_id, user_id, subscription_id, token_transaction_id)
       values ($1, $2, $3, $4)`,
      [row.id, userId, subscriptionId, tokenTransactionId ?? null],
    );

    const periodEndResult = await client.query<{ expires_at: string }>(
      `select now() + make_interval(months => $1::int) as expires_at`,
      [row.months],
    );

    await client.query(
      `insert into public.subscription_activation_events (
         subscription_id, user_id, workspace_id, plan_id, billing_order_id, payment_id,
         source, event_type, period_start, period_end, metadata
       ) values ($1, $2, $3, $4, $5, $6, 'gift_redemption', 'gift_redeemed', now(),
         now() + make_interval(months => $7::int),
         jsonb_build_object('giftId', $8::uuid, 'months', $7::int))`,
      [
        subscriptionId,
        userId,
        workspaceId,
        row.plan_id,
        row.billing_order_id,
        row.purchased_payment_id,
        row.months,
        row.id,
      ],
    );

    return {
      status: "redeemed" as const,
      gift_id: row.id,
      subscription_id: subscriptionId,
      tokens_added: row.token_grant,
      plan_name: gift.plan_name,
      months: row.months,
      expires_at:
        periodEndResult.rows[0]?.expires_at ?? new Date().toISOString(),
    };
  });
}

export async function listPurchasedGiftsForUser(userId: string) {
  return query<{
    id: string;
    plan_name: string;
    plan_id: string;
    months: number;
    status: string;
    delivery_method: "email" | "link";
    recipient_email: string | null;
    claim_token: string | null;
    code_prefix: string;
    code_last4: string;
    amount_paise: number;
    purchased_at: string | null;
    expires_at: string;
  }>(
    `select id, plan_name, plan_id, months, status, delivery_method,
            recipient_email, claim_token, code_prefix, code_last4,
            amount_paise, purchased_at, expires_at
     from public.gift_codes
     where purchaser_user_id = $1
       and status in ('purchased', 'redeemed', 'expired')
     order by coalesce(purchased_at, created_at) desc
     limit 50`,
    [userId],
  );
}

export async function redeemGiftCode(userId: string, plainCode: string) {
  const normalizedCode = plainCode.trim();
  if (!normalizedCode || normalizedCode.length > GIFT_CODE_MAX_LEN) {
    throw new AppError("Gift code was not found.", 404, "gift_not_found"); // invalid/oversized — same response as missing code
  }

  return withTransaction(async (client) => {
    await client.query(`select public.expire_old_gift_codes()`); // stale pending/expired rows cleanup

    const giftResult = await client.query<GiftRow>(
      `select id, status, expires_at, plan_id, months, token_grant, code_prefix,
              billing_order_id, purchased_payment_id
       from public.gift_codes
       where code_hash = public.hash_gift_code($1)
       for update`,
      [normalizedCode],
    ); // hash match — concurrent double-redeem race lock
    const gift = giftResult.rows[0];
    if (!gift)
      throw new AppError("Gift code was not found.", 404, "gift_not_found"); // invalid hash
    if (gift.status !== "purchased") {
      throw new AppError(
        "Gift code is not redeemable.",
        400,
        "gift_not_redeemable",
      );
    }
    if (new Date(gift.expires_at) <= new Date()) {
      await client.query(
        `update public.gift_codes set status = 'expired', updated_at = now() where id = $1`,
        [gift.id],
      );
      throw new AppError("Gift code has expired.", 400, "gift_expired");
    }

    const profileResult = await client.query<{ workspace_id: string | null }>(
      `select default_workspace_id as workspace_id from public.profiles where id = $1`,
      [userId],
    );
    const workspaceId = profileResult.rows[0]?.workspace_id ?? null;
    const nullWorkspace = "00000000-0000-0000-0000-000000000000"; // SQL coalesce sentinel — NULL workspace match

    await client.query(
      `update public.subscriptions s
       set status = 'superseded',
           updated_at = now(),
           metadata = metadata || jsonb_build_object('supersededByGiftId', $3::text)
       where s.user_id = $1
         and coalesce(s.workspace_id, $2::uuid) = coalesce($4::uuid, $2::uuid)
         and s.status in ('trialing', 'active', 'past_due')`,
      [userId, nullWorkspace, gift.id, workspaceId],
    );

    const subResult = await client.query<{ id: string }>(
      `insert into public.subscriptions (
         user_id, workspace_id, plan_id, provider, provider_subscription_id, status,
         billing_cycle, current_period_start, current_period_end, cancel_at_period_end, metadata
       ) values (
         $1, $2, $3, 'gift', $4::text, 'active', 'gift', now(),
         now() + make_interval(months => $5::int), true,
         jsonb_build_object('giftId', $4::text, 'giftMonths', $5::int, 'giftCodePrefix', $6::text)
       )
       returning id`,
      [
        userId,
        workspaceId,
        gift.plan_id,
        gift.id,
        gift.months,
        gift.code_prefix,
      ],
    );
    const subscriptionId = subResult.rows[0]?.id;
    if (!subscriptionId)
      throw new AppError("Failed to create subscription.", 500);

    const creditResult = await client.query<{ id: string }>(
      `select txn.id
       from public.credit_user_tokens(
         $1, $2, $3, 'purchase',
         jsonb_build_object('giftId', $4::uuid, 'planId', $5::text, 'months', $6::int)
       ) as txn`,
      [
        userId,
        gift.token_grant,
        `gift_${gift.id}`,
        gift.id,
        gift.plan_id,
        gift.months,
      ],
    ); // bundled token grant — ledger function
    const tokenTransactionId = creditResult.rows[0]?.id;

    await client.query(
      `update public.gift_codes
       set status = 'redeemed',
           redeemed_at = now(),
           redeemed_by_user_id = $2,
           updated_at = now()
       where id = $1`,
      [gift.id, userId],
    );

    await client.query(
      `insert into public.gift_redemptions (gift_id, user_id, subscription_id, token_transaction_id)
       values ($1, $2, $3, $4)`,
      [gift.id, userId, subscriptionId, tokenTransactionId ?? null],
    ); // immutable redemption audit row

    const periodEndResult = await client.query<{ expires_at: string }>(
      `select now() + make_interval(months => $2::int) as expires_at`,
      [gift.id, gift.months],
    );

    await client.query(
      `insert into public.subscription_activation_events (
         subscription_id, user_id, workspace_id, plan_id, billing_order_id, payment_id,
         source, event_type, period_start, period_end, metadata
       ) values ($1, $2, $3, $4, $5, $6, 'gift_redemption', 'gift_redeemed', now(),
         now() + make_interval(months => $7::int),
         jsonb_build_object('giftId', $8::uuid, 'months', $7::int))`,
      [
        subscriptionId,
        userId,
        workspaceId,
        gift.plan_id,
        gift.billing_order_id,
        gift.purchased_payment_id,
        gift.months,
        gift.id,
      ],
    ); // analytics/billing timeline — original Razorpay payment refs preserve

    return {
      status: "redeemed" as const,
      gift_id: gift.id,
      subscription_id: subscriptionId,
      tokens_added: gift.token_grant,
      expires_at:
        periodEndResult.rows[0]?.expires_at ?? new Date().toISOString(),
    }; // service layer → API JSON
  });
}
