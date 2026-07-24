"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  CARD_BRAND_ICONS,
  type CardBrandId,
} from "@/lib/checkout-payment-icons";

/**
 * Stripe-style card brand affordance:
 * - empty field → faint row of accepted brands
 * - typing → single detected brand icon (crisp)
 */
export function CheckoutCardBrandStack({
  brands,
  detected,
}: {
  brands?: CardBrandId[];
  detected?: CardBrandId | null;
}) {
  const list = brands && brands.length ? brands : [];

  if (detected) {
    const icon = CARD_BRAND_ICONS[detected];
    return (
      <div className="pointer-events-none flex items-center" aria-hidden>
        <img
          src={icon.src}
          alt=""
          width={32}
          height={20}
          className="h-5 w-8 rounded-[3px] object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none flex items-center gap-0.5"
      aria-hidden
    >
      {list.map((brandId) => {
        const icon = CARD_BRAND_ICONS[brandId];
        return (
          <img
            key={brandId}
            src={icon.src}
            alt=""
            width={28}
            height={18}
            className={cn(
              "h-[18px] w-7 rounded-[2.5px] object-contain opacity-90",
            )}
            draggable={false}
          />
        );
      })}
    </div>
  );
}
