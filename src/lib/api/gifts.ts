import { apiFetch } from "@/lib/api/client";

function trimOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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
  return apiFetch<{
    gift: { id: string; code: string; codePrefix: string; codeLast4: string };
    order: { id: string; razorpay_order_id: string };
    razorpay: {
      orderId: string;
      amount: number;
      currency: string;
      keyId?: string;
    };
    pricing: { subtotalPaise: number; taxPaise: number; amountPaise: number };
  }>("/api/v1/gifts/purchase", {
    method: "POST",
    // JSON.stringify — request body serialize
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
    // JSON.stringify — request body serialize
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
      // JSON.stringify — request body serialize
      body: JSON.stringify({
        razorpayOrderId: input.razorpayOrderId.trim(),
        razorpayPaymentId: input.razorpayPaymentId.trim(),
        razorpaySignature: input.razorpaySignature.trim(),
      }),
    },
  );
}
