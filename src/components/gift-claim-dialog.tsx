"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import { GiftAnimation } from "@/components/gift-animation";

export type GiftClaimDialogGift = {
  planName: string;
  months: number;
  senderName?: string | null;
  message?: string | null;
  themeColor?: string | null;
};

type GiftClaimDialogProps = {
  open: boolean;
  gift: GiftClaimDialogGift;
  claiming?: boolean;
  claimed?: boolean;
  error?: string | null;
  onClaim: () => void;
  onClose: () => void;
};

export function GiftClaimDialog({
  open,
  gift,
  claiming = false,
  claimed = false,
  error,
  onClaim,
  onClose,
}: GiftClaimDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!mounted) return null;

  const durationLabel =
    gift.months === 12
      ? "1 year"
      : gift.months === 1
        ? "1 month"
        : `${gift.months} months`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="gift-claim-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-[240] bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            key="gift-claim-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-claim-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[241] flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className={cn(
                chrome.overlay.panel,
                "w-full max-w-[400px] overflow-hidden",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative flex flex-col items-center px-6 pb-6 pt-8"
                style={{
                  background: gift.themeColor
                    ? `linear-gradient(165deg, ${gift.themeColor} 0%, color-mix(in srgb, ${gift.themeColor} 72%, white) 48%, white 100%)`
                    : "linear-gradient(165deg, #e4e4e7 0%, #fafafa 60%, white 100%)",
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.55),transparent_55%)]" />
                <div className="relative">
                  <GiftAnimation />
                </div>
              </div>

              <div className="px-6 pb-6 pt-5 text-center">
                {claimed ? (
                  <>
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="h-5 w-5 text-emerald-600" strokeWidth={2.5} />
                    </div>
                    <h2
                      id="gift-claim-title"
                      className="font-serif text-[22px] font-medium text-zinc-900"
                    >
                      Gift claimed
                    </h2>
                    <p className="app-page-muted mt-2 leading-relaxed">
                      {durationLabel} of Clauxen {gift.planName} is now on your
                      account.
                    </p>
                    <Button
                      type="button"
                      onClick={onClose}
                      className={cn(appBtn.primaryLg, "mt-6 w-full")}
                    >
                      Start chatting
                    </Button>
                  </>
                ) : (
                  <>
                    <h2
                      id="gift-claim-title"
                      className="font-serif text-[22px] font-medium text-zinc-900"
                    >
                      You are gifted {gift.planName}
                    </h2>
                    <p className="app-page-muted mt-1">
                      {durationLabel} of Clauxen {gift.planName}
                    </p>
                    {error && (
                      <p className="mt-3 text-[13px] text-red-600">{error}</p>
                    )}
                    <Button
                      type="button"
                      disabled={claiming}
                      onClick={onClaim}
                      className={cn(appBtn.primaryLg, "mt-6 w-full")}
                    >
                      {claiming ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Claiming…
                        </>
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
