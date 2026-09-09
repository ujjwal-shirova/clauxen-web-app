"use client";

import React from "react";

/** Full-screen gate until auth + checkout session are ready — no form chrome. */
export function CheckoutBootstrapping({
  message = "Preparing secure checkout…",
}: {
  message?: string;
}) {
  return (
    <div
      className="checkout-shell items-center justify-center px-6"
      role="status"
      aria-live="polite"
      data-checkout-bootstrapping=""
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--settings-hairline)] border-t-[var(--settings-fg)]"
          aria-hidden
        />
        <p className="text-[13px] font-medium text-[var(--settings-fg-muted)]">
          {message}
        </p>
      </div>
    </div>
  );
}
