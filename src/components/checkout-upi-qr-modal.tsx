"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import { UPI_APP_ICONS } from "@/lib/checkout-payment-icons";
import { cn } from "@/lib/utils";

const DEFAULT_QR_TTL_SECONDS = 20 * 60;

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function secondsUntil(closeBy: number | null | undefined): number {
  if (!closeBy) return DEFAULT_QR_TTL_SECONDS;
  return Math.max(0, closeBy - Math.floor(Date.now() / 1000));
}

export function CheckoutUpiQrModal({
  open,
  imageUrl,
  amountLabel,
  closeBy,
  onClose,
}: {
  open: boolean;
  /** Clean square PNG (data URL or same-origin proxy) — never tall branded card. */
  imageUrl: string | null;
  amountLabel: string;
  /** Unix seconds — countdown target for the QR session. */
  closeBy?: number | null;
  onClose: (reason?: "cancel" | "timeout") => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const expiredHandledRef = useRef(false);
  const qrReady = Boolean(imageUrl) && imageLoaded;

  useEffect(() => {
    if (!open) {
      setImageLoaded(false);
      setSecondsLeft(0);
      setCountdownActive(false);
      expiredHandledRef.current = false;
      return;
    }
    setImageLoaded(false);
    setSecondsLeft(0);
    setCountdownActive(false);
    expiredHandledRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(false);
      setCountdownActive(false);
      expiredHandledRef.current = false;
      return;
    }
    // Inline data: URLs can skip onLoad — mark ready immediately so the square paints.
    if (imageUrl.startsWith("data:")) {
      setImageLoaded(true);
      return;
    }
    setImageLoaded(false);
    setCountdownActive(false);
    expiredHandledRef.current = false;
  }, [imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Start countdown only after the QR image is actually visible.
  useEffect(() => {
    if (!open || !qrReady) return;
    setSecondsLeft(secondsUntil(closeBy));
    setCountdownActive(true);
  }, [open, qrReady, closeBy]);

  useEffect(() => {
    if (!open || !countdownActive) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, countdownActive]);

  // Auto-close when the QR session expires (only after countdown has started).
  useEffect(() => {
    if (!open || !countdownActive) return;
    if (secondsLeft > 0 || expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    onClose("timeout");
  }, [open, countdownActive, secondsLeft, onClose]);

  if (!open) return null;

  const showShimmer = !qrReady;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      {/* Stable washout — div (not button) so global button:hover cannot tint it */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[rgba(24,24,27,0.42)] backdrop-blur-[6px]"
        onClick={() => onClose("cancel")}
      />

      <div
        className={cn(
          "relative z-[205] w-full max-w-[520px] overflow-hidden rounded-t-3xl border border-zinc-200/90 bg-white shadow-[0_-8px_40px_rgba(24,24,27,0.1)] sm:mx-4 sm:rounded-[28px] sm:shadow-[0_24px_64px_rgba(24,24,27,0.14)]",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upi-qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
          <h2
            id="upi-qr-title"
            className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-900"
          >
            UPI QR
          </h2>
          {qrReady ? (
            <div
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[13px] font-medium tabular-nums text-zinc-700"
              aria-live="polite"
              title="QR expires in"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="text-zinc-500"
              >
                <path
                  d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 3a.75.75 0 0 1 .75.75v3.69l2.16 1.25a.75.75 0 1 1-.75 1.3l-2.5-1.44A.75.75 0 0 1 7.25 8V3.75A.75.75 0 0 1 8 3Z"
                  fill="currentColor"
                />
              </svg>
              {formatCountdown(secondsLeft)}
            </div>
          ) : (
            <div className="h-7 w-[72px]" aria-hidden />
          )}
        </div>

        <div className="px-5 pb-6 pt-3 sm:px-6">
          <div className="rounded-2xl bg-zinc-100/90 p-4 sm:p-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
              {/* Fixed square — clean upi:// QR (from image_content), never tall branded card */}
              <div
                className="relative h-[192px] w-[192px] shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80"
                aria-busy={showShimmer}
              >
                {showShimmer ? (
                  <div
                    className="checkout-upi-qr-shimmer absolute inset-0 rounded-xl"
                    aria-label="Generating QR code"
                    role="status"
                  />
                ) : null}

                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- clean square PNG / data URL
                  <img
                    src={imageUrl}
                    alt="UPI QR code"
                    width={192}
                    height={192}
                    className={cn(
                      // Keep quiet zone — square modules must stay scannable.
                      "relative z-[1] h-full w-full bg-white object-contain p-2 transition-opacity duration-200",
                      imageLoaded ? "opacity-100" : "opacity-0",
                    )}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[15px] font-medium leading-snug text-zinc-600">
                  Scan the QR using any UPI App
                </p>
                <p className="mt-1 text-[13px] text-zinc-400">
                  Pay {amountLabel}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                  {UPI_APP_ICONS.map((app) => (
                    <div
                      key={app.alt}
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-200/80 bg-white"
                      title={app.alt}
                    >
                      <CheckoutPaymentIcon
                        src={app.src}
                        alt={app.alt}
                        className="h-6 w-6"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose("cancel")}
            className="no-hover mt-4 w-full rounded-xl py-2.5 text-[14px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
