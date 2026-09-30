import { randomBytes } from "crypto";
import { AppError } from "@/server/db/errors";
import { query, queryOne, withTransaction } from "@/server/db/pool"; // parameterized SQL + atomic txn

const GIFT_CODE_MAX_LEN = 64; // hash input upper bound — oversized redeem attempts reject
const CLAIM_TOKEN_MAX_LEN = 64;
/** Final gift codes are exactly 20 unambiguous chars (see migration). */
export const GIFT_CODE_FINAL_LEN = 20;

export function generateClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Normalize user-typed codes: strip spaces/dashes, uppercase. */
export function normalizeGiftCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/** Display grouping for 20-char codes: XXXX-XXXX-XXXX-XXXX-XXXX. */
export function formatGiftCodeForDisplay(code: string): string {
  const normalized = normalizeGiftCodeInput(code);
  if (normalized.length !== GIFT_CODE_FINAL_LEN) return code.trim().toUpperCase();
  return normalized.replace(/(.{4})(?=.)/g, "$1-");
}

export async function generateGiftCodePlaintext() {
  // Prefer the 20-char unambiguous generator; fall back to legacy CX- codes
  // when the production migration has not been applied yet.
  try {
    const row = await queryOne<{ code: string }>(
      `select public.generate_gift_code_20() as code`,
    );
    if (row?.code && normalizeGiftCodeInput(row.code).length === GIFT_CODE_FINAL_LEN) {
      return normalizeGiftCodeInput(row.code);
    }
  } catch {
    // Fall through to legacy generator below.
  }
  const legacy = await queryOne<{ code: string }>(
    `select public.generate_gift_code() as code`,
  ); // Postgres function
  if (!legacy?.code) {
    throw new AppError(
      "Failed to generate gift code.",
      500,
      "gift_code_generation_failed",
    ); // function failure — rare infra issue
  }
  return legacy.code;
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
  const normalizedCode = normalizeGiftCodeInput(input.plainCode);
  const prefix =
    normalizedCode.length === GIFT_CODE_FINAL_LEN
      ? normalizedCode.slice(0, 4)
      : input.plainCode.slice(0, 7);
  const last4 = normalizedCode.slice(-4);

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
       now() + interval '24 hours'
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
    purchaser_email: string;
    message: string | null;
    billing_order_id: string | null;
    token_grant: number;
    subtotal_paise: number;
    tax_paise: number;
    amount_paise: number;
  }>(
    `select id, status, plan_id, plan_name, months, claim_token, delivery_method,
            recipient_email, sender_name, purchaser_email, message, billing_order_id,
            token_grant, subtotal_paise, tax_paise, amount_paise
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
     set status = 'sent',
         last_error = null,
         updated_at = now(),
         sent_at = coalesce(sent_at, now())
     where gift_id = $1`,
    [giftId],
  );
}

export async function recordGiftDeliveryFailure(giftId: string, error: string) {
  await query(
    `update public.gift_delivery_jobs
     set attempts = attempts + 1,
         last_error = left($2, 500),
         updated_at = now()
     where gift_id = $1`,
    [giftId, error],
  );
}

export async function listQueuedGiftIdsForPurchaser(userId: string) {
  const rows = await query<{ id: string }>(
    `select g.id
     from public.gift_codes g
     join public.gift_delivery_jobs j on j.gift_id = g.id
     where g.purchaser_user_id = $1
       and g.status = 'purchased'
       and j.status = 'queued'
       and j.attempts < 5
     order by j.updated_at asc
     limit 5`,
    [userId],
  );
  return rows.map((row) => row.id);
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
  const normalizedCode = normalizeGiftCodeInput(plainCode);
  if (!normalizedCode || normalizedCode.length > GIFT_CODE_MAX_LEN) {
    throw new AppError("Gift code was not found.", 404, "gift_not_found"); // invalid/oversized — same response as missing code
  }

  // Try normalized (dash-stripped) first, then raw trimmed for legacy CX- codes
  // whose hash includes dashes.
  const candidates = [normalizedCode];
  const rawTrimmed = plainCode.trim().toUpperCase();
  if (rawTrimmed !== normalizedCode) candidates.push(rawTrimmed);

  return withTransaction(async (client) => {
    await client.query(`select public.expire_old_gift_codes()`); // stale pending/expired rows cleanup

    const giftResult = await client.query<GiftRow>(
      `select id, status, expires_at, plan_id, months, token_grant, code_prefix,
              billing_order_id, purchased_payment_id
       from public.gift_codes
       where code_hash = public.hash_gift_code($1)
          or code_hash = public.hash_gift_code($2)
       for update`,
      [candidates[0], candidates[1] ?? candidates[0]],
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

/**
 * Mint the FINAL 20-char gift code immediately after Razorpay capture.
 * Idempotent: first caller rotates (FOR UPDATE lock); repeats return null
 * (code already emailed — never rotate twice).
 * Returns plaintext final code (caller emails it immediately; never stored).
 */
export async function rotateGiftCodeAfterPurchase(
  giftId: string,
): Promise<{ code: string; codePrefix: string; codeLast4: string } | null> {
  return withTransaction(async (client) => {
    const locked = await client.query<{
      id: string;
      status: string;
      code_rotated_at: string | null;
    }>(
      `select id, status, code_rotated_at
       from public.gift_codes
       where id = $1
       for update`,
      [giftId],
    );
    const row = locked.rows[0];
    if (!row || row.status !== "purchased") return null;
    if (row.code_rotated_at) return null; // already finalized — do not re-rotate

    const plainCode = await generateGiftCodePlaintext();
    const normalized = normalizeGiftCodeInput(plainCode);
    const prefix =
      normalized.length === GIFT_CODE_FINAL_LEN
        ? normalized.slice(0, 4)
        : plainCode.slice(0, 7);
    const last4 = normalized.slice(-4);

    await client.query(
      `update public.gift_codes
       set code_hash = public.hash_gift_code($2),
           code_prefix = $3,
           code_last4 = $4,
           code_rotated_at = now(),
           updated_at = now()
       where id = $1`,
      [giftId, normalized, prefix, last4],
    );

    return { code: normalized, codePrefix: prefix, codeLast4: last4 };
  });
}

/** Full gift row for post-payment delivery (recipient + purchaser emails). */
export async function getGiftForDelivery(giftId: string) {
  return queryOne<{
    id: string;
    status: string;
    plan_id: string;
    plan_name: string;
    months: number;
    claim_token: string;
    delivery_method: "email" | "link";
    recipient_email: string | null;
    recipient_name: string | null;
    purchaser_email: string;
    purchaser_user_id: string;
    sender_name: string;
    sender_email: string;
    message: string | null;
    theme_color: string | null;
    code_prefix: string;
    code_last4: string;
    amount_paise: number;
    purchased_at: string | null;
    expires_at: string;
  }>(    `select id, status, plan_id, plan_name, months, claim_token, delivery_method,
            recipient_email, recipient_name, purchaser_email, purchaser_user_id,
            sender_name, sender_email, message, theme_color, code_prefix, code_last4,
            amount_paise, purchased_at, expires_at
     from public.gift_codes
     where id = $1
     limit 1`,
    [giftId],
  );
}

/** Purchaser-owned gift details for the post-payment success UI (no secrets). */
export async function getPurchasedGiftForOwner(giftId: string, userId: string) {
  return queryOne<{
    id: string;
    status: string;
    plan_id: string;
    plan_name: string;
    months: number;
    claim_token: string;
    delivery_method: "email" | "link";
    recipient_email: string | null;
    recipient_name: string | null;
    code_prefix: string;
    code_last4: string;
    amount_paise: number;
    purchased_at: string | null;
    expires_at: string;
  }>(
    `select id, status, plan_id, plan_name, months, claim_token, delivery_method,
            recipient_email, recipient_name, code_prefix, code_last4,
            amount_paise, purchased_at, expires_at
     from public.gift_codes
     where id = $1 and purchaser_user_id = $2
     limit 1`,
    [giftId, userId],
  );
}

/** Delivery job status for idempotent gift emails (null = never queued). */
export async function getGiftDeliveryStatus(giftId: string) {
  return queryOne<{ status: string; sent_at: string | null }>(
    `select status, sent_at
     from public.gift_delivery_jobs
     where gift_id = $1
     limit 1`,
    [giftId],
  );
}

/**
 * Force-rotate the gift code (recovery path: previous rotation's plaintext was
 * lost before email send). Overwrites hash/prefix/last4 with a fresh 20-char
 * code. Caller must email the returned plaintext immediately.
 */
export async function forceRotateGiftCode(
  giftId: string,
): Promise<{ code: string; codePrefix: string; codeLast4: string } | null> {
  return withTransaction(async (client) => {
    const locked = await client.query<{ id: string; status: string }>(
      `select id, status
       from public.gift_codes
       where id = $1
       for update`,
      [giftId],
    );
    const row = locked.rows[0];
    if (!row || row.status !== "purchased") return null;

    const plainCode = await generateGiftCodePlaintext();
    const normalized = normalizeGiftCodeInput(plainCode);
    const prefix =
      normalized.length === GIFT_CODE_FINAL_LEN
        ? normalized.slice(0, 4)
        : plainCode.slice(0, 7);
    const last4 = normalized.slice(-4);

    await client.query(
      `update public.gift_codes
       set code_hash = public.hash_gift_code($2),
           code_prefix = $3,
           code_last4 = $4,
           code_rotated_at = now(),
           updated_at = now()
       where id = $1`,
      [giftId, normalized, prefix, last4],
    );

    return { code: normalized, codePrefix: prefix, codeLast4: last4 };
  });
}
