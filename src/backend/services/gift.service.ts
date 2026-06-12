import * as billingRepo from "@/backend/repositories/billing.repository";
// gifts repository — gift_codes table: generate, create, link order, redeem
import * as giftsRepo from "@/backend/repositories/gifts.repository";
// Razorpay client helpers — configured check, order id/receipt, hosted checkout order
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  newOrderId,
  newReceipt,
} from "@/backend/billing/razorpay";
import { getServerUsdInrRate } from "@/backend/billing/checkout-currency-server";
import { AppError } from "@/backend/db/errors";
import {
  toRazorpayChargeAmount,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";

const GIFT_PLAN_ALIASES: Record<string, string> = {
  max5x: "max5x", // Max tier 5x multiplier alias
  max20x: "max20x", // Max tier 20x multiplier alias
};

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
  const gift = await giftsRepo.createGiftCode({
    plainCode,
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

  // insert failure guard — rare DB error; 500 without leaking internals
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
    tokens: 1,
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
    },
    order,
    razorpay: {
      orderId: razorpay.id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      keyId:
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    },
    pricing: { subtotalPaise, taxPaise, amountPaise },
  };
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
