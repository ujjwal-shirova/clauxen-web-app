"use client";

import React from "react";
import { Pencil } from "lucide-react";
import { checkoutUi } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";
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
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        checkoutUi.field,
        "flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:border-zinc-400",
      )}
      aria-label="Edit billing address"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#6d6e78]">
          Billing address
        </p>
        <div className="mt-1 space-y-0.5">
          {lines.map((line) => (
            <p
              key={line}
              className="truncate text-[14px] leading-5 text-[#121212]"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
    </button>
  );
}
