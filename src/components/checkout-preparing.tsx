"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCheckoutPreparingFeatures,
  type MaxTier,
} from "@/lib/plans-catalog";

const ROTATE_MS = 1600;

const lineMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
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
    <div className="app-surface-shell fixed inset-0 z-[110] flex items-center justify-center">
      <div className="mx-6 w-full max-w-[520px] text-center">
        <h1
          className="checkout-preparing-title app-page-title text-[22px] tracking-[-0.03em] sm:text-[24px]"
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
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="app-page-muted absolute inset-x-0 top-0 px-4 leading-relaxed"
            >
              {activeLine}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
