"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";
import type { CardBrandId } from "@/lib/checkout-payment-icons";

// Clean, crisp inline brand marks sized for real checkout card fields.
// All logos are visible side-by-side (matching standard payment pages).
// Detected brand is highlighted with full opacity + subtle ring.

const BRAND_LOGOS: Record<CardBrandId, React.ReactNode> = {
  visa: (
    <div className="flex h-3.5 w-[22px] items-center justify-center rounded-[1px] bg-[#1A1F71] text-[7px] font-black tracking-[0.5px] text-white">
      VISA
    </div>
  ),
  mastercard: (
    <div className="relative h-3.5 w-[22px]">
      <div className="absolute left-[1px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#EB001B]" />
      <div className="absolute right-[1px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#F79E1B]" />
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF5F00] opacity-70" />
    </div>
  ),
  amex: (
    <div className="flex h-3.5 w-[22px] items-center justify-center rounded-[1px] bg-[#006FCF] text-[6px] font-bold tracking-[0.5px] text-white">
      AMEX
    </div>
  ),
  rupay: (
    <div className="flex h-3.5 w-[22px] items-center justify-center rounded-[1px] bg-[#097939] text-[6px] font-bold tracking-[0.25px] text-white">
      RuPay
    </div>
  ),
  jcb: (
    <div className="flex h-3.5 w-[22px] items-center justify-center rounded-[1px] bg-[#0E4C94] text-[7px] font-bold text-white">
      JCB
    </div>
  ),
  discover: (
    <div className="flex h-3.5 w-[22px] items-center justify-center rounded-[1px] bg-[#FF6000] text-[5.5px] font-extrabold tracking-[0.5px] text-white">
      DISCOVER
    </div>
  ),
};

const DEFAULT_BRANDS: CardBrandId[] = [
  "visa",
  "mastercard",
  "amex",
  "rupay",
  "discover",
];

export function CheckoutCardBrandStack({
  brands,
  detected,
}: {
  brands?: CardBrandId[];
  detected?: CardBrandId | null;
}) {
  const list = (brands && brands.length ? brands : DEFAULT_BRANDS).slice(0, 5);

  return (
    <div
      className="pointer-events-none flex items-center gap-px"
      aria-hidden
    >
      {list.map((brandId) => {
        const isActive = detected ? brandId === detected : true;
        return (
          <div
            key={brandId}
            className={cn(
              "flex items-center justify-center rounded-[1.5px] bg-white transition-all",
              isActive ? "opacity-100" : "opacity-45 grayscale-[0.2]",
            )}
            style={{ height: 14, minWidth: 22 }}
          >
            {BRAND_LOGOS[brandId]}
          </div>
        );
      })}
    </div>
  );
}
