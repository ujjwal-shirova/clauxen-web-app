"use client";

import React, { useEffect } from "react";
import { CheckoutPaymentIcon } from "@/frontend/components/checkout-payment-icon";
import {
  CARD_BRAND_ICONS,
  CHECKOUT_UPI_ICON_URL,
} from "@/lib/checkout-payment-icons";
import { checkoutUi } from "@/frontend/lib/checkout-ui";

const UPI_APP_ICONS = [
  { alt: "UPI", src: CHECKOUT_UPI_ICON_URL },
  { alt: "RuPay", src: CARD_BRAND_ICONS.rupay.src },
  { alt: "Mastercard", src: CARD_BRAND_ICONS.mastercard.src },
  { alt: "Visa", src: CARD_BRAND_ICONS.visa.src },
];

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-white/75"
        onClick={onClose}
      />

      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed right-3 top-4 z-[210] flex h-6 w-6 items-center justify-center rounded-full text-zinc-900"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8.00085 6.58514L12.5928 1.99318C12.9837 1.60229 13.6175 1.60229 14.0083 1.99318C14.3992 2.38406 14.3992 3.01781 14.0083 3.4087L9.41703 8.00001L14.0083 12.5913C14.3992 12.9822 14.3992 13.616 14.0083 14.0068C13.6175 14.3977 12.9837 14.3977 12.5928 14.0068L8.00085 9.41488L3.40888 14.0068C3.018 14.3977 2.38425 14.3977 1.99336 14.0068C1.60247 13.616 1.60247 12.9822 1.99336 12.5913L6.58467 8.00001L1.99336 3.4087C1.60247 3.01781 1.60247 2.38406 1.99336 1.99318C2.38425 1.60229 3.018 1.60229 3.40888 1.99318L8.00085 6.58514Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <div className="relative z-[205] mx-4 w-full max-w-md rounded-md bg-white px-8 pb-8 pt-6 shadow-none">
        <h2 className="text-center text-xl font-medium leading-7 text-zinc-900">
          Authorize payment with your app
        </h2>

        <p className="mt-4 text-center text-sm font-medium leading-[18px] text-[#596171]">
          Scan this QR code using your preferred UPI app and follow the
          instructions to pay {amountLabel}.
        </p>

        <div className="mt-4 flex justify-center">
          <div className={checkoutUi.panel}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="UPI QR code"
                width={128}
                height={128}
                className="h-32 w-32"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-500">
                Loading…
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm font-medium text-[rgba(26,26,26,0.7)]">
          UPI is supported in multiple apps
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {UPI_APP_ICONS.map((app) => (
            <div
              key={app.alt}
              className="flex h-[25px] w-[25px] items-center justify-center overflow-hidden rounded bg-white"
            >
              <CheckoutPaymentIcon
                src={app.src}
                alt={app.alt}
                className="h-[25px] w-[25px]"
              />
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[rgba(26,26,26,0.6)]">
          Powered by Razorpay
        </p>
      </div>
    </div>
  );
}
