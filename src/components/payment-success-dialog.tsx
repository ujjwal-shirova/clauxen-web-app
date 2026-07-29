"use client";

import React, { useEffect } from "react";
import { Check } from "lucide-react";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { cn } from "@/lib/utils";

const CLAUXEN_LOGO_SRC = "/assets/icons/clauxen-icon.png";

type PaymentSuccessDialogProps = {
  open: boolean;
  planName?: string | null;
  onGetStarted: () => void;
};

/**
 * Post-checkout success card — shown on /new?checkout=success before chat use.
 */
export function PaymentSuccessDialog({
  open,
  planName,
  onGetStarted,
}: PaymentSuccessDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onGetStarted();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onGetStarted]);

  if (!open) return null;

  const planLabel = planName?.trim() || "your plan";

  return (
    <FullscreenPortal>
      <div
        className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-success-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onGetStarted();
        }}
      >
        <div
          className={cn(
            "w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-300",
            "rounded-[22px] border border-zinc-200/80 bg-white p-7 shadow-[0_24px_80px_rgba(0,0,0,0.18)]",
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5">
              {}
              <img
                src={CLAUXEN_LOGO_SRC}
                alt="Clauxen"
                width={56}
                height={56}
                className="h-14 w-14 rounded-[14px] object-cover shadow-sm"
                draggable={false}
              />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              </span>
            </div>

            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Payment successful
            </p>
            <h2
              id="payment-success-title"
              className="mt-2 text-[22px] font-semibold leading-7 tracking-tight text-zinc-900"
            >
              You&apos;re on {planLabel}
            </h2>
            <p className="mt-2 max-w-[32ch] text-[14px] leading-5 text-zinc-500">
              Your plan is active. Get started with the power of Clauxen — open
              a new chat and put your upgrade to work.
            </p>

            <button
              type="button"
              onClick={onGetStarted}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-zinc-900 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
            >
              Get started
            </button>
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}
