"use client";

import React, { useEffect } from "react";
import { CheckoutPaymentIcon } from "@/frontend/components/checkout-payment-icon";
import { UPI_APP_ICONS } from "@/lib/checkout-payment-icons";
import { checkoutUi } from "@/frontend/lib/checkout-ui";
import { appBtn } from "@/frontend/lib/app-buttons";
import { cn } from "@/frontend/lib/utils";

export function CheckoutUpiQrModal({
  open,
  imageUrl,
  amountLabel,
  onClose,
}: {
  open: boolean;
  imageUrl: string | null;
  amountLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-zinc-900/25 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative z-[205] w-full max-w-md overflow-hidden rounded-t-3xl border border-zinc-200/90 bg-white shadow-[0_-8px_40px_rgba(24,24,27,0.08)] sm:mx-4 sm:rounded-3xl sm:shadow-[0_24px_64px_rgba(24,24,27,0.12)]",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upi-qr-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2
            id="upi-qr-title"
            className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-900"
          >
            Pay with UPI
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cn(appBtn.ghostIcon, "h-8 w-8 text-zinc-500")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.00085 6.58514L12.5928 1.99318C12.9837 1.60229 13.6175 1.60229 14.0083 1.99318C14.3992 2.38406 14.3992 3.01781 14.0083 3.4087L9.41703 8.00001L14.0083 12.5913C14.3992 12.9822 14.3992 13.616 14.0083 14.0068C13.6175 14.3977 12.9837 14.3977 12.5928 14.0068L8.00085 9.41488L3.40888 14.0068C3.018 14.3977 2.38425 14.3977 1.99336 14.0068C1.60247 13.616 1.60247 12.9822 1.99336 12.5913L6.58467 8.00001L1.99336 3.4087C1.60247 3.01781 1.60247 2.38406 1.99336 1.99318C2.38425 1.60229 3.018 1.60229 3.40888 1.99318L8.00085 6.58514Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-7 pt-5">
          <p className="text-center text-[14px] leading-relaxed text-zinc-500">
            Scan this QR with your preferred UPI app and follow the prompts to
            pay {amountLabel}.
          </p>

          <div className="mt-5 flex justify-center">
            <div className={cn(checkoutUi.panel, "p-3")}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="UPI QR code"
                  width={168}
                  height={168}
                  className="h-[168px] w-[168px]"
                />
              ) : (
                <div
                  className="h-[168px] w-[168px] animate-pulse rounded-xl bg-gradient-to-br from-zinc-100 via-zinc-200/70 to-zinc-100"
                  aria-label="Generating QR code"
                  role="status"
                />
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-[12px] font-medium uppercase tracking-[0.06em] text-zinc-400">
            Works with
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {UPI_APP_ICONS.map((app) => (
              <div
                key={app.alt}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                title={app.alt}
              >
                <CheckoutPaymentIcon
                  src={app.src}
                  alt={app.alt}
                  className="h-7 w-7"
                />
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-zinc-400">
            Secured by Razorpay · shirova
          </p>
        </div>
      </div>
    </div>
  );
}
