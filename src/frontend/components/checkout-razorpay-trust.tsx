"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";

const RAZORPAY_LOGO_SRC = "/checkout/razorpay-logo.svg";

/**
 * Trust line under the Pay button — vendored Razorpay wordmark (no CDN at runtime).
 */
export function CheckoutRazorpayTrust({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-1.5 text-[12px] leading-5 text-zinc-500",
        className,
      )}
    >
      <span>Payment is handled by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={RAZORPAY_LOGO_SRC}
        alt="Razorpay"
        width={72}
        height={15}
        className="h-[15px] w-auto opacity-90"
        draggable={false}
      />
    </p>
  );
}
