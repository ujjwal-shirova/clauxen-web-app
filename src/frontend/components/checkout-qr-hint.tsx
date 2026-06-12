"use client";

import { checkoutUi } from "@/frontend/lib/checkout-ui";

export function CheckoutQrHint() {
  return (
    <p className={checkoutUi.hint}>
      <svg
        className="mr-3 h-[42px] w-[42px] shrink-0"
        role="presentation"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M22.5 6L22.5 2.5C22.5 1.94772 22.0523 1.5 21.5 1.5L18 1.5"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 1.5H2.5C1.94772 1.5 1.5 1.94772 1.5 2.5V6"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M1.5 18L1.5 21.5C1.5 22.0523 1.94772 22.5 2.5 22.5L6 22.5"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 22.5L21.5 22.5C22.0523 22.5 22.5 22.0523 22.5 21.5L22.5 18"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="6"
          y="6"
          width="4"
          height="4"
          rx="0.5"
          fill="currentColor"
          fillOpacity="0.7"
        />
        <rect
          x="14"
          y="6"
          width="4"
          height="4"
          rx="0.5"
          fill="currentColor"
          fillOpacity="0.7"
        />
        <rect
          x="10"
          y="10"
          width="4"
          height="4"
          rx="0.5"
          fill="currentColor"
          fillOpacity="0.7"
        />
        <rect
          x="6"
          y="14"
          width="4"
          height="4"
          rx="0.5"
          fill="currentColor"
          fillOpacity="0.7"
        />
        <rect
          x="14"
          y="14"
          width="4"
          height="4"
          rx="0.5"
          fill="currentColor"
          fillOpacity="0.7"
        />
      </svg>
      <span>
        You will be shown a QR code to scan with your preferred payment app.
      </span>
    </p>
  );
}
