"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";

interface GiftPaymentProps {
  onBack: () => void;
}

/**
 * Legacy in-overlay payment step — hosted checkout replaced Razorpay Standard Checkout.
 * Shown only if navigation to hosted checkout fails before redirect.
 */
export function GiftPayment({ onBack }: GiftPaymentProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <h1 className="mb-6 font-serif text-[28px] font-medium text-zinc-800">
        Continue to checkout
      </h1>
      <div className="mb-8 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-[14px] leading-relaxed text-zinc-600">
          Payment continues on our secure hosted checkout page. If you were not
          redirected automatically, go back and try again.
        </p>
      </div>
      <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className={cn(appBtn.secondary, "h-10 rounded-xl px-8")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
