"use client";

import React, { useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { checkoutUi } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";
import { INDIA_STATES } from "@/lib/india-states";

export type CheckoutAddressState = {
  fullName: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pin: string;
  state: string;
  /** True when name + enough address fields are filled for UPI pay. */
  isComplete: boolean;
};

function composeAddressLine(state: CheckoutAddressState): string {
  return [state.addressLine1, state.addressLine2, state.city, state.state, state.pin]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
}

export function isCheckoutAddressComplete(state: CheckoutAddressState): boolean {
  return (
    state.fullName.trim().length >= 2 &&
    state.addressLine1.trim().length >= 3 &&
    state.city.trim().length >= 2 &&
    /^\d{6}$/.test(state.pin.trim()) &&
    state.state.trim().length >= 2
  );
}

/** Human-readable reason Pay stays disabled for UPI address. */
export function getCheckoutAddressIncompleteReason(
  state: CheckoutAddressState,
): string | null {
  if (state.fullName.trim().length < 2) return "Enter your full name.";
  if (state.addressLine1.trim().length < 3) return "Enter address line 1.";
  if (state.city.trim().length < 2) return "Enter your city.";
  if (!/^\d{6}$/.test(state.pin.trim())) {
    return "Enter a valid 6-digit PIN code.";
  }
  if (state.state.trim().length < 2) return "Select your state.";
  return null;
}

/** Full billing address in one view — no progressive expand, no Places API. */
export function CheckoutBillingAddress({
  value,
  onChange,
}: {
  value: CheckoutAddressState;
  onChange: (next: CheckoutAddressState) => void;
}) {
  const patch = useCallback(
    (partial: Partial<CheckoutAddressState>) => {
      const next = { ...value, ...partial };
      next.isComplete = isCheckoutAddressComplete(next);
      onChange(next);
    },
    [onChange, value],
  );

  const pinInvalid =
    value.pin.length > 0 && !/^\d{6}$/.test(value.pin.trim());

  return (
    <div className="flex flex-col gap-3">
      <h3 className="px-1 text-[15px] font-semibold text-[#121212]">
        Billing address
      </h3>

      <input
        type="text"
        autoComplete="name"
        placeholder="Full name"
        value={value.fullName}
        onChange={(e) => patch({ fullName: e.target.value })}
        className={checkoutUi.field}
      />

      <label
        className={cn(checkoutUi.field, "relative flex flex-col gap-0.5 py-2")}
      >
        <span className="text-[11px] font-medium leading-none text-[#6d6e78]">
          Country or region
        </span>
        <select
          value={value.countryCode}
          onChange={(e) => patch({ countryCode: e.target.value })}
          className="w-full appearance-none bg-transparent pr-6 text-base text-[#121212] outline-none"
          aria-label="Country or region"
        >
          <option value="IN">India</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          strokeWidth={1.75}
        />
      </label>

      <input
        type="text"
        autoComplete="address-line1"
        placeholder="Address line 1"
        value={value.addressLine1}
        onChange={(e) => patch({ addressLine1: e.target.value })}
        className={checkoutUi.field}
      />

      <input
        type="text"
        autoComplete="address-line2"
        placeholder="Address line 2"
        value={value.addressLine2}
        onChange={(e) => patch({ addressLine2: e.target.value })}
        className={checkoutUi.field}
      />

      <input
        type="text"
        autoComplete="address-level2"
        placeholder="City"
        value={value.city}
        onChange={(e) => patch({ city: e.target.value })}
        className={checkoutUi.field}
      />

      <div className="grid grid-cols-[2fr_3fr] gap-3">
        <div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="PIN"
            value={value.pin}
            onChange={(e) =>
              patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
            }
            className={cn(
              checkoutUi.field,
              pinInvalid && "border-[#DF1B41] focus:border-[#DF1B41]",
            )}
            aria-invalid={pinInvalid}
          />
          {pinInvalid && (
            <p className={cn(checkoutUi.errorText, "mt-1 px-1")}>
              PIN must be 6 digits
            </p>
          )}
        </div>
        <label
          className={cn(
            checkoutUi.field,
            "relative flex flex-col gap-0.5 py-2",
          )}
        >
          <span className="text-[11px] font-medium leading-none text-[#6d6e78]">
            State
          </span>
          <select
            value={value.state}
            onChange={(e) => patch({ state: e.target.value })}
            className="w-full appearance-none bg-transparent pr-6 text-base text-[#121212] outline-none"
            aria-label="State"
          >
            <option value="">Select state</option>
            {INDIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            strokeWidth={1.75}
          />
        </label>
      </div>
    </div>
  );
}

export function checkoutAddressToBillingLine(
  state: CheckoutAddressState,
): string {
  return composeAddressLine(state) || "India";
}
