"use client";

import React from "react";
import type { CheckoutAddressState } from "@/components/checkout-billing-address";

export function CheckoutBillingAddressSummary({
  address,
  onEdit,
}: {
  address: CheckoutAddressState;
  onEdit: () => void;
}) {
  const lines = [
    address.fullName,
    [address.addressLine1, address.addressLine2].filter(Boolean).join(", "),
    [address.city, address.state, address.pin].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--settings-fg)]">
          Billing address
        </p>
        <div className="mt-1.5 space-y-0.5">
          {lines.map((line) => (
            <p
              key={line}
              className="truncate text-[13px] leading-[18px] text-[var(--settings-fg-muted)]"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 pt-0.5 text-[13px] font-medium text-[var(--settings-fg)]"
      >
        Edit
      </button>
    </div>
  );
}
