import * as billingRepo from "@/server/repositories/billing.repository";
import * as giftsRepo from "@/server/repositories/gifts.repository";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  newOrderId,
  newReceipt,
} from "@/server/billing/razorpay";
import { getServerUsdInrRate } from "@/server/billing/checkout-currency-server";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import {
  toRazorpayChargeAmount,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import { sendGiftNotificationEmail } from "@/server/billing/billing-email";

const GIFT_PLAN_ALIASES: Record<string, string> = {
  max5x: "max5x",
  max20x: "max20x",
};

function appOrigin(): string {
  return (env.appUrl || "https://www.clauxen.com").replace(/\/$/, "");
}

export function giftClaimUrl(claimToken: string): string {
  return `${appOrigin()}/gift/claim/${encodeURIComponent(claimToken)}`;
}

export async function purchaseGift(input: {
  userId: string;
  userEmail: string;
  planId: string;
  months: number;
  recipientEmail?: string | null;
  recipientName?: string | null;
  senderName: string;
  senderEmail: string;
  deliveryMethod: "email" | "link";
  message?: string | null;
  themeColor?: string | null;
  currency?: CheckoutCurrency;
}) {
  if (!isRazorpayConfigured()) {
    throw new AppError(
      "Razorpay keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      503,
      "billing_unavailable",
    );
  }

  if (input.months < 1 || input.months > 12) {
    throw new AppError("months must be between 1 and 12.", 400);
  }

  const planId = GIFT_PLAN_ALIASES[input.planId] ?? input.planId;
  const plan = await billingRepo.getPlanById(planId);
  if (!plan?.giftable) {
    throw new AppError(
      "Plan is not available for gifting.",
      400,
      "plan_not_giftable",
    );
  }

  const currency: CheckoutCurrency = input.currency ?? "INR";
  const subtotalPaise = plan.price_paise_monthly * input.months;
  const taxPaise =
    currency === "USD" ? 0 : Math.round(subtotalPaise * 0.18);
  const amountPaise = subtotalPaise + taxPaise;
  const charge = toRazorpayChargeAmount(
    amountPaise,
    currency,
    getServerUsdInrRate(),
  );
  const tokenGrant = plan.token_grant * input.months;

  const plainCode = await giftsRepo.generateGiftCodePlaintext();
  const claimToken = giftsRepo.generateClaimToken();
  const gift = await giftsRepo.createGiftCode({
    plainCode,
    claimToken,
    purchaserUserId: input.userId,
    purchaserEmail: input.userEmail,
    recipientEmail: input.recipientEmail ?? null,
    recipientName: input.recipientName ?? null,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    deliveryMethod: input.deliveryMethod,
    message: input.message ?? null,
    themeColor: input.themeColor ?? null,
    planId: plan.id,
    planName: plan.display_name,
    months: input.months,
    tokenGrant,
    subtotalPaise,
    taxPaise,
    amountPaise,
  });

  if (!gift) throw new AppError("Failed to create gift.", 500);

  const orderId = newOrderId();
  const receipt = newReceipt();
  const razorpay = await createRazorpayOrder({
    amountMinor: charge.amount,
    currency: charge.currency,
    receipt,
    notes: {
      plan_id: plan.id,
      user_id: input.userId,
      gift_id: gift.id,
      order_kind: "gift",
      charge_currency: charge.currency,
      inr_total_paise: String(amountPaise),
    },
  });

  const order = await billingRepo.createBillingOrder({
    id: orderId,
    razorpayOrderId: razorpay.id,
    userId: input.userId,
    userEmail: input.userEmail,
    planId: plan.id,
    planName: plan.display_name,
    billingCycle: "monthly",
    subtotalPaise,
    taxPaise,
    amountPaise,
    tokens: 0,
    receipt,
    orderKind: "gift",
    giftId: gift.id,
  });

  await giftsRepo.linkGiftToOrder(gift.id, razorpay.id);

  return {
    gift: {
      id: gift.id,
      code: plainCode,
      codePrefix: gift.code_prefix,
      codeLast4: gift.code_last4,
      claimToken: gift.claim_token,
      claimUrl: giftClaimUrl(gift.claim_token),
      months: input.months,
      planName: plan.display_name,
    },
    order,
    razorpay: {
      orderId: razorpay.id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      keyId: env.publicRazorpayKeyId || env.razorpayKeyId,
    },
    pricing: { subtotalPaise, taxPaise, amountPaise },
  };
}

export async function listPurchasedGifts(userId: string) {
  const rows = await giftsRepo.listPurchasedGiftsForUser(userId);
  return rows.map((row) => ({
    id: row.id,
    plan_name: row.plan_name,
    plan_id: row.plan_id,
    months: row.months,
    status: row.status,
    delivery_method: row.delivery_method,
    recipient_email: row.recipient_email,
    claim_token: row.status === "purchased" ? row.claim_token : null,
    claim_url:
      row.status === "purchased" && row.claim_token
        ? giftClaimUrl(row.claim_token)
        : null,
    code_prefix: row.code_prefix,
    code_last4: row.code_last4,
    amount_paise: row.amount_paise,
    purchased_at: row.purchased_at,
    expires_at: row.expires_at,
  }));
}

export async function getClaimPreview(claimToken: string) {
  const gift = await giftsRepo.getGiftByClaimToken(claimToken);
  if (gift.status === "pending_payment") {
    throw new AppError(
      "This gift is not ready yet.",
      400,
      "gift_not_ready",
    );
  }
  if (gift.status === "expired" || new Date(gift.expires_at) <= new Date()) {
    throw new AppError("This gift has expired.", 400, "gift_expired");
  }
  if (gift.status === "redeemed") {
    throw new AppError(
      "This gift has already been claimed.",
      400,
      "gift_already_redeemed",
    );
  }
  if (gift.status !== "purchased") {
    throw new AppError(
      "Gift is not redeemable.",
      400,
      "gift_not_redeemable",
    );
  }

  return {
    plan_name: gift.plan_name,
    plan_id: gift.plan_id,
    months: gift.months,
    sender_name: gift.sender_name,
    message: gift.message,
    theme_color: gift.theme_color,
    status: gift.status,
    expires_at: gift.expires_at,
  };
}

export async function claimGiftByToken(userId: string, claimToken: string) {
  try {
    return await giftsRepo.redeemGiftByClaimToken(userId, claimToken);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Redemption failed.", 400, "gift_redeem_failed");
  }
}

export async function redeemGift(userId: string, code: string) {
  const trimmed = code.trim();
  if (!trimmed) throw new AppError("Gift code is required.", 400);
  try {
    return await giftsRepo.redeemGiftCode(userId, trimmed);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Redemption failed.", 400, "gift_redeem_failed");
  }
}

/** After payment fulfill — email recipient (or purchaser for share-link). */
export async function deliverPurchasedGift(giftId: string): Promise<boolean> {
  const gift = await giftsRepo.getPurchasedGiftForDelivery(giftId);
  if (!gift || gift.status !== "purchased" || !gift.claim_token) {
    return false;
  }

  try {
    await giftsRepo.queueGiftDelivery(giftId);
  } catch (err) {
    console.warn("[gift] queue_gift_delivery failed", err);
  }

  const claimUrl = giftClaimUrl(gift.claim_token);
  const monthsLabel =
    gift.months === 1 ? "1 month" : `${gift.months} months`;

  if (gift.delivery_method === "email") {
    const to = gift.recipient_email?.trim();
    if (!to) {
      console.warn("[gift] email delivery missing recipient", giftId);
      return false;
    }
    const ok = await sendGiftNotificationEmail({
      kind: "gift_received",
      to,
      planName: gift.plan_name,
      monthsLabel,
      senderName: gift.sender_name,
      message: gift.message,
      claimUrl,
    });
    if (ok) await giftsRepo.markGiftDeliverySent(giftId);
    return ok;
  }

  // Share-link: email the claim link to the purchaser so they can share it.
  const to = gift.purchaser_email?.trim();
  if (!to) return false;
  const ok = await sendGiftNotificationEmail({
    kind: "gift_share_link",
    to,
    planName: gift.plan_name,
    monthsLabel,
    senderName: gift.sender_name,
    message: gift.message,
    claimUrl,
  });
  if (ok) await giftsRepo.markGiftDeliverySent(giftId);
  return ok;
}

export async function getGiftCheckoutOrderForUser(
  userId: string,
  giftId: string,
) {
  const gift = await giftsRepo.getGiftByIdForPurchaser(giftId, userId);
  if (!gift) throw new AppError("Gift not found.", 404, "not_found");
  if (gift.status !== "pending_payment") {
    throw new AppError(
      "Gift is not awaiting payment.",
      400,
      "gift_not_payable",
    );
  }
  if (!gift.billing_order_id) {
    throw new AppError("Gift order is missing.", 400, "gift_order_missing");
  }

  const order = await billingRepo.getBillingOrderByRazorpayId(
    gift.billing_order_id,
  );
  if (!order || order.user_id !== userId) {
    throw new AppError("Order not found.", 404, "not_found");
  }

  return {
    gift,
    order,
    razorpay: {
      orderId: order.razorpay_order_id,
      amount: order.amount_paise,
      currency: order.currency,
      keyId: env.publicRazorpayKeyId || env.razorpayKeyId,
    },
    pricing: {
      subtotalPaise: gift.subtotal_paise,
      taxPaise: gift.tax_paise,
      amountPaise: gift.amount_paise,
    },
  };
}
