"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import { GiftAnimation } from "@/components/gift-animation";

export type GiftPurchaseSuccessData = {
  planName: string;
  months?: number;
  deliveryMethod: "email" | "link";
  claimUrl?: string | null;
  giftCode?: string | null;
  recipientEmail?: string | null;
};

type GiftPurchaseSuccessDialogProps = {
  open: boolean;
  gift: GiftPurchaseSuccessData;
  onClose: () => void;
};

export function GiftPurchaseSuccessDialog({
  open,
  gift,
  onClose,
}: GiftPurchaseSuccessDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = useCallback(async () => {
    if (!gift.claimUrl) return;
    try {
      await navigator.clipboard.writeText(gift.claimUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [gift.claimUrl]);

  if (!mounted) return null;

  const durationLabel =
    gift.months === 12
      ? "1 year"
      : gift.months === 1
        ? "1 month"
        : gift.months
          ? `${gift.months} months`
          : null;

  const isLink = gift.deliveryMethod === "link";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="gift-purchase-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-[240] bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            key="gift-purchase-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-purchase-success-title"
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
                "w-full max-w-[420px] overflow-hidden",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex flex-col items-center bg-zinc-50 px-6 pb-5 pt-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.7),transparent_55%)]" />
                <div className="relative">
                  <GiftAnimation />
                </div>
                <div className="relative mt-4 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </div>
              </div>

              <div className="px-6 pb-6 pt-5 text-center">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  Payment successful
                </p>
                <h2
                  id="gift-purchase-success-title"
                  className="mt-2 font-serif text-[22px] font-medium text-zinc-900"
                >
                  Gift purchased
                </h2>
                <p className="app-page-muted mt-2 leading-relaxed">
                  {durationLabel
                    ? `${durationLabel} of Clauxen ${gift.planName}`
                    : `Clauxen ${gift.planName}`}
                  {isLink
                    ? " is ready to share."
                    : gift.recipientEmail
                      ? ` will be emailed to ${gift.recipientEmail}.`
                      : " will be emailed to your recipient."}
                </p>

                {isLink && gift.claimUrl ? (
                  <div className="mt-5 space-y-2 text-left">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">
                      Gift link
                    </p>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                      <code className="block break-all text-[12px] leading-5 text-zinc-800">
                        {gift.claimUrl}
                      </code>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleCopy()}
                      className={cn(appBtn.primaryLg, "w-full")}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy link
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                      <p className="text-[13px] leading-relaxed text-zinc-600">
                        We sent an email with a{" "}
                        <span className="font-medium text-zinc-800">
                          Claim the gift
                        </span>{" "}
                        button
                        {gift.recipientEmail
                          ? ` to ${gift.recipientEmail}`
                          : " to your recipient"}
                        . You can also find this gift under Settings → Billing.
                      </p>
                    </div>
                  </div>
                )}

                {!isLink && gift.giftCode ? (
                  <div className="mt-4 space-y-1.5 text-left">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">
                      Backup gift code
                    </p>
                    <code className="app-page-body block rounded-[var(--radius-sm)] border border-[var(--ui-border)] bg-white px-3 py-2 font-semibold tracking-wide">
                      {gift.giftCode}
                    </code>
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className={cn(
                    appBtn.secondary,
                    "mt-4 w-full",
                    isLink && gift.claimUrl && "mt-3",
                  )}
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
