"use client";

import { checkoutUi } from "@/frontend/lib/checkout-ui";

export function CheckoutErrorBanner({ message }: { message: string }) {
  return (
    <div className={checkoutUi.errorBanner}>
      <span className="font-medium">{message}</span>
    </div>
  );
}
