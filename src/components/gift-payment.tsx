"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button"; // Button UI component — Back/Pay now actions
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { ApiError } from "@/lib/api/client"; // ApiError — server-sanitized messages only in UI
import { verifyGiftPayment } from "@/lib/api/gifts"; // verifyGiftPayment API — Razorpay payment signature server-side verify
import { openRazorpayCheckout } from "@/lib/razorpay-checkout"; // openRazorpayCheckout helper — Razorpay modal checkout launch
import {
  formatCheckoutAmountFromPaise,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import { useAuth } from "@/hooks/use-auth"; // useAuth hook — logged-in user name/email checkout prefill

interface GiftPaymentProps {
  // GiftPaymentProps interface — gift checkout step parent props
  onBack: () => void;
  currentDurationLabel: string; // currentDurationLabel — selected plan duration display (e.g. "1 month")
  giftCode: string;
  razorpay: {
    orderId: string;
    amount: number;
    currency: string;
    keyId?: string;
  };
  pricing: { subtotalPaise: number; taxPaise: number; amountPaise: number };
  displayCurrency: CheckoutCurrency;
  usdInrRate: number;
  onPaid: () => void;
}

export function GiftPayment({
  onBack, // onBack prop destructure — back navigation handler
  currentDurationLabel, // currentDurationLabel prop destructure — plan duration label display
  giftCode,
  razorpay, // razorpay prop destructure — Razorpay order config
  pricing, // pricing prop destructure — price breakdown amounts
  displayCurrency,
  usdInrRate,
  onPaid, // onPaid prop destructure — payment success completion handler
}: GiftPaymentProps) {
  const auth = useAuth(); // auth state — current user displayName/email Razorpay prefill
  const [paying, setPaying] = useState(false); // paying state — checkout modal open/processing indicator
  const [payError, setPayError] = useState<string | null>(null); // payError state — payment failure message display

  const formatPaise = (paise: number) =>
    formatCheckoutAmountFromPaise(paise, displayCurrency, usdInrRate);

  const handlePay = async () => {
    if (!razorpay.keyId) {
      setPayError("Razorpay is not configured.");
      return;
    }
    setPayError(null);
    setPaying(true);
    try {
      await openRazorpayCheckout({
        keyId: razorpay.keyId, // Razorpay merchant public key
        orderId: razorpay.orderId, // server-side created order ID
        amount: razorpay.amount,
        currency: razorpay.currency, // currency code (INR)
        name: "Clauxen Gift", // checkout modal merchant display name
        description: `Gift subscription · ${currentDurationLabel}`,
        prefill: {
          name: auth.user?.displayName ?? undefined, // user display name optional prefill
          email: auth.user?.email ?? undefined, // user email optional prefill
        },
        onSuccess: async (payment) => {
          await verifyGiftPayment({
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
          onPaid();
        },
      });
    } catch (error) {
      // catch block — checkout cancel, network failure, verification error
      setPayError(
        error instanceof ApiError ? error.message : "Payment failed.",
      );
    } finally {
      setPaying(false); // paying false — button re-enable, loading state reset
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      {" "}
      {/* root container — step transition animation */}
      <h1 className="text-[28px] font-serif font-medium text-zinc-800 mb-6">
        Review and pay
      </h1>{" "}
      {/* page heading — checkout review step title */}
      <div className="p-4 rounded-xl border border-black/15 mb-4 bg-zinc-50">
        {" "}
        {/* pricing card — subtotal/tax/total breakdown */}
        <div className="flex justify-between text-[14px] mb-2">
          <span>Subtotal</span>
          <span className="font-medium">
            {formatPaise(pricing.subtotalPaise)}
          </span>
        </div>{" "}
        {/* subtotal row — pre-tax amount */}
        {pricing.taxPaise > 0 && (
          <div className="flex justify-between text-[14px] mb-2">
            <span>Tax (18% GST)</span>
            <span className="font-medium">{formatPaise(pricing.taxPaise)}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-semibold pt-2 border-t border-black/10">
          <span>Total due today</span>
          <span>{formatPaise(pricing.amountPaise)}</span>
        </div>
      </div>
      <div className="p-4 rounded-xl border border-black/15 mb-6 bg-white">
        {" "}
        {/* gift code card — redeem code display */}
        <p className="text-[12px] text-zinc-500 mb-1">
          Gift code (save after payment)
        </p>
        <code className="text-[14px] font-semibold text-zinc-800">
          {giftCode}
        </code>{" "}
        {/* giftCode monospace — copy-friendly redeem code */}
      </div>
      <div className="space-y-4 mb-8 text-[12px] text-zinc-500 leading-relaxed">
        {" "}
        {/* legal/disclaimer section — subscription terms */}
        <p>
          Your gift subscription ends after {currentDurationLabel} and will not
          auto-renew. Unredeemed gifts expire one year after purchase.
        </p>{" "}
        {/* expiry disclaimer — non-renewing gift, 1 year unredeemed expiry */}
        <p>
          By clicking Pay now, you authorize Clauxen to charge your payment
          method for the amount shown.
        </p>{" "}
        {/* payment authorization disclaimer — charge consent */}
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
        <Button
          variant="outline"
          onClick={onBack} // Back button — previous gift configuration step
          className={cn(appBtn.secondary, "h-10 rounded-xl px-8")}
        >
          Back
        </Button>{" "}
        {/* outline Back button — non-destructive navigation */}
        <Button
          type="button"
          disabled={paying} // disabled while paying — duplicate checkout prevent
          onClick={() => void handlePay()} // Pay now click — async handlePay invoke (void unhandled promise)
          className={cn(appBtn.primaryLgAuto, "px-8")}
        >
          {paying ? "Opening checkout…" : "Pay now"}{" "}
          {/* dynamic label — loading vs ready state */}
        </Button>{" "}
        {/* primary Pay button — Razorpay checkout trigger */}
      </div>
      {payError && <p className="mt-3 text-[12px] text-red-600">{payError}</p>}{" "}
      {/* conditional error — payment failure message red text */}
    </div>
  );
}
