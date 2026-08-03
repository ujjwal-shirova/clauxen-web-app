import { apiFetch } from "@/lib/api/client";

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type GiftPurchaseResult = {
  gift: {
    id: string;
    code: string;
    codePrefix: string;
    codeLast4: string;
    claimToken?: string;
    claimUrl?: string;
  };
  order: { id: string; razorpay_order_id: string };
  razorpay: {
    orderId: string;
    amount: number;
    currency: string;
    keyId?: string;
  };
  pricing: { subtotalPaise: number; taxPaise: number; amountPaise: number };
};

export type GiftClaimPreview = {
  plan_name: string;
  plan_id: string;
  months: number;
  sender_name: string;
  message: string | null;
  theme_color: string | null;
  status: string;
  expires_at: string;
};

export type GiftClaimRedemption = {
  status: string;
  gift_id: string;
  subscription_id: string;
  tokens_added: number;
  plan_name?: string;
  months?: number;
  expires_at: string;
};

export async function purchaseGift(input: {
  planId: string;
  months: number;
  recipientEmail?: string;
  recipientName?: string;
  senderName: string;
  senderEmail: string;
  deliveryMethod: "email" | "link";
  message?: string;
  themeColor?: string;
  currency?: "INR" | "USD";
}) {
  return apiFetch<GiftPurchaseResult>("/api/v1/gifts/purchase", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      planId: input.planId.trim(),
      months: input.months,
      recipientEmail: trimOptional(input.recipientEmail),
      recipientName: trimOptional(input.recipientName),
      senderName: input.senderName.trim(),
      senderEmail: input.senderEmail.trim(),
      message: trimOptional(input.message),
      themeColor: trimOptional(input.themeColor),
      currency: input.currency,
    }),
  });
}

export async function getGiftClaim(token: string) {
  const normalized = token.trim();
  return apiFetch<{ gift: GiftClaimPreview }>(
    `/api/v1/gifts/claim/${encodeURIComponent(normalized)}`,
  );
}

export async function claimGift(token: string) {
  const normalized = token.trim();
  return apiFetch<{ redemption: GiftClaimRedemption }>(
    `/api/v1/gifts/claim/${encodeURIComponent(normalized)}`,
    { method: "POST" },
  );
}

export async function redeemGift(code: string) {
  const normalizedCode = code.trim();
  return apiFetch<{
    redemption: {
      status: string;
      gift_id: string;
      subscription_id: string;
      tokens_added: number;
      expires_at: string;
    };
  }>("/api/v1/gifts/redeem", {
    method: "POST",
    body: JSON.stringify({ code: normalizedCode }),
  });
}

export async function verifyGiftPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return apiFetch<{ fulfillment: { status?: string } | null }>(
    "/api/v1/billing/orders/verify",
    {
      method: "POST",
      body: JSON.stringify({
        razorpayOrderId: input.razorpayOrderId.trim(),
        razorpayPaymentId: input.razorpayPaymentId.trim(),
        razorpaySignature: input.razorpaySignature.trim(),
      }),
    },
  );
}

const GIFT_PURCHASE_STORAGE_KEY = "clauxen:gift-purchase-pending";

export type StoredGiftPurchase = {
  giftId?: string;
  giftCode: string;
  claimUrl?: string;
  claimToken?: string;
  planName: string;
  months?: number;
  deliveryMethod: "email" | "link";
  recipientEmail?: string;
};

export function storePendingGiftPurchase(data: StoredGiftPurchase) {
  try {
    sessionStorage.setItem(GIFT_PURCHASE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function readPendingGiftPurchase(): StoredGiftPurchase | null {
  try {
    const raw = sessionStorage.getItem(GIFT_PURCHASE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredGiftPurchase;
  } catch {
    return null;
  }
}

export function clearPendingGiftPurchase() {
  try {
    sessionStorage.removeItem(GIFT_PURCHASE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type PurchasedGiftRow = {
  id: string;
  plan_name: string;
  plan_id: string;
  months: number;
  status: string;
  delivery_method: "email" | "link";
  recipient_email: string | null;
  claim_token: string | null;
  claim_url: string | null;
  code_prefix: string;
  code_last4: string;
  amount_paise: number;
  purchased_at: string | null;
  expires_at: string;
};

export async function listPurchasedGifts() {
  return apiFetch<{ gifts: PurchasedGiftRow[] }>("/api/v1/gifts/purchased");
}
