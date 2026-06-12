"use client";

import React from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
  CARD_BRAND_ICONS,
  type CardBrandId,
} from "@/lib/checkout-payment-icons";

const ICON_WIDTH = 28;
const ICON_HEIGHT = 18;

export function CheckoutCardBrandStack({ brands }: { brands: CardBrandId[] }) {
  return (
    <LayoutGroup>
      <div
        className="relative flex h-[18px] items-center"
        style={{ width: ICON_WIDTH * 2 + 12 }}
        aria-hidden
      >
        {brands.map((brandId, index) => (
          <motion.div
            key={brandId}
            layout
            layoutId={`card-brand-${brandId}`}
            transition={{ type: "spring", stiffness: 520, damping: 38 }}
            className="absolute top-0 overflow-hidden rounded-[3px] border border-[#e0e0e0] bg-white shadow-[0_1px_1px_0_rgba(0,0,0,0.06)]"
            style={{
              width: ICON_WIDTH,
              height: ICON_HEIGHT,
              right: index * 14,
              zIndex: index + 1,
            }}
          >
            <img
              src={CARD_BRAND_ICONS[brandId].src}
              alt=""
              width={ICON_WIDTH}
              height={ICON_HEIGHT}
              className="h-full w-full object-contain p-px"
              draggable={false}
            />
          </motion.div>
        ))}
      </div>
    </LayoutGroup>
  );
}
