"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCheckoutPreparingFeatures,
  type MaxTier,
} from "@/lib/plans-catalog";

const ROTATE_MS = 2000;

const lineMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export function CheckoutPreparing({
  planId,
  maxTier = "5x",
}: {
  planId: string;
  maxTier?: MaxTier;
}) {
  const descriptions = useMemo(
    () => getCheckoutPreparingFeatures(planId, maxTier),
    [planId, maxTier],
  );

  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    setLineIndex(0);
  }, [planId, maxTier]);

  useEffect(() => {
    if (descriptions.length <= 1) return;

    const interval = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % descriptions.length);
    }, ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [descriptions.length]);

  const activeLine = descriptions[lineIndex] ?? descriptions[0] ?? "";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white">
      <div className="mx-6 w-full max-w-[520px] text-center">
        <h1
          className="checkout-preparing-title text-[22px] font-medium tracking-[-0.2px]"
          aria-live="polite"
        >
          Getting your plan ready
        </h1>

        <div
          className="relative mt-3 h-[52px] overflow-hidden"
          aria-live="polite"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${planId}-${lineIndex}-${activeLine}`}
              initial={lineMotion.initial}
              animate={lineMotion.animate}
              exit={lineMotion.exit}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 top-0 px-4 text-[15px] leading-relaxed text-zinc-500"
            >
              {activeLine}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
