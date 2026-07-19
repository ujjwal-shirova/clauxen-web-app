"use client";

import React, { useEffect } from "react";
import { CheckoutPaymentIcon } from "@/frontend/components/checkout-payment-icon";
import { CHECKOUT_UPI_ICON_URL } from "@/lib/checkout-payment-icons";
import { checkoutUi } from "@/frontend/lib/checkout-ui";

const UPI_APP_ICONS = [
  {
    alt: "Google Pay",
    src: "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#fff"/><path fill="#4285F4" d="M12.2 11.1v2.3h3.4c-.1.8-.7 2.3-2.1 3.1l-.1.1 2.5 1.9c1.5-1.4 2.3-3.4 2.3-5.8 0-.6-.1-1.1-.2-1.6H12.2z"/><path fill="#34A853" d="M7.1 14.3l-.1.1 2 1.5c.5.4 1.2.8 2.1.8 1.3 0 2.3-.4 3.1-1.2l-2.5-1.9c-.4.3-.9.5-1.5.5-.9 0-1.7-.6-2-1.4l-.1-.1-2-.3z"/><path fill="#FBBC05" d="M7 11.8c-.1-.3-.2-.6-.2-1s.1-.7.2-1l-.1-.1-2-.3C4.6 10.1 4.4 11 4.4 12s.2 1.9.5 2.7l2.1-.9z"/><path fill="#EA4335" d="M12.1 7.5c.9 0 1.7.3 2.3.9l1.7-1.7C15.1 5.7 13.7 5 12.1 5c-2.3 0-4.2 1.3-5.1 3.2l2.1.9c.5-1 1.5-1.6 3-1.6z"/></svg>`,
    ),
  },
  {
    alt: "PhonePe",
    src: "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#5F259F"/><text x="12" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#fff">Pe</text></svg>`,
    ),
  },
  {
    alt: "Paytm",
    src: "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#00BAF2"/><text x="12" y="15.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="800" fill="#fff">paytm</text></svg>`,
    ),
  },
  {
    alt: "BHIM",
    src: "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#fff" stroke="#E5E7EB"/><text x="12" y="15.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="800" fill="#0B5C9E">BHIM</text></svg>`,
    ),
  },
  { alt: "UPI", src: CHECKOUT_UPI_ICON_URL },
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
                width={160}
                height={160}
                className="h-40 w-40"
              />
            ) : (
              <div
                className="h-40 w-40 animate-pulse rounded-md bg-gradient-to-br from-zinc-100 via-zinc-200/80 to-zinc-100"
                aria-label="Generating QR code"
                role="status"
              />
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
              title={app.alt}
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
          Powered by Razorpay · shirova
        </p>
      </div>
    </div>
  );
}
