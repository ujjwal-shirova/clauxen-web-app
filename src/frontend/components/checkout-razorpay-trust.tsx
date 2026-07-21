"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";

const RAZORPAY_LOGO_SRC = "/checkout/razorpay-logo.svg";
/** Shirova Razorpay merchant / trust landing. */
const RAZORPAY_TRUST_HREF = "https://rzp.io/rzp/iWoiuD9X";

/**
 * Trust line under the Pay button — vendored Razorpay wordmark (no CDN at runtime).
 * Logo links out to the Razorpay merchant page.
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
      <a
        href={RAZORPAY_TRUST_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-sm opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        aria-label="Razorpay (opens in a new tab)"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={RAZORPAY_LOGO_SRC}
          alt="Razorpay"
          width={72}
          height={15}
          className="h-[15px] w-auto"
          draggable={false}
        />
      </a>
    </p>
  );
}
