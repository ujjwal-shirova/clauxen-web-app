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
      className="app-surface-shell flex min-h-[100dvh] w-full items-center justify-center px-6"
      role="status"
      aria-live="polite"
      data-checkout-bootstrapping=""
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800"
          aria-hidden
        />
        <p className="app-page-muted font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
