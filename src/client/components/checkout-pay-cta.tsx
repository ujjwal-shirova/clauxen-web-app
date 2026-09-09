"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { CheckoutRazorpayTrust } from "@/components/checkout-razorpay-trust";
import { checkoutUi } from "@/lib/checkout-ui";

export const CHECKOUT_FORM_ID = "clauxen-checkout-form";

export function CheckoutPayCta({
  paying,
  payDisabled,
  payLabel,
  payDisabledReason,
  variablePlanNotice,
  onPayPrepare,
  form = CHECKOUT_FORM_ID,
}: {
  paying: boolean;
  payDisabled: boolean;
  payLabel: string;
  payDisabledReason?: string | null;
  variablePlanNotice?: string | null;
  onPayPrepare?: () => void;
  form?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        form={form}
        disabled={payDisabled}
        onPointerDown={() => {
          if (!payDisabled) onPayPrepare?.();
        }}
        className={cn(
          appBtn.primaryLg,
          "no-hover-overlay w-full !h-12 !min-h-[3rem] !text-[15px]",
          payDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        {paying ? "Processing…" : payLabel}
      </button>
      <CheckoutRazorpayTrust />
      {payDisabled && payDisabledReason && !paying ? (
        <p className={cn(checkoutUi.errorText, "text-center")}>
          {payDisabledReason}
        </p>
      ) : null}
      {variablePlanNotice ? (
        <p className={cn(checkoutUi.labelFine, "text-center")}>
          {variablePlanNotice}
        </p>
      ) : null}
    </div>
  );
}
