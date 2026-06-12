"use client";

import { checkoutUi } from "@/frontend/lib/checkout-ui";

export function CheckoutOrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className={checkoutUi.orLine} />
      <span className={checkoutUi.orLabel}>OR</span>
      <div className={checkoutUi.orLine} />
    </div>
  );
}
