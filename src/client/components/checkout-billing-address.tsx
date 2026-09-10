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
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className={checkoutUi.sectionTitle}>Billing address</h2>

      <div className="checkout-address-grid">
        <div className="checkout-address-grid__wide">
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-full-name">
            Full name
          </label>
          <input
            id="checkout-full-name"
            type="text"
            autoComplete="name"
            value={value.fullName}
            onChange={(e) => patch({ fullName: e.target.value })}
            className={checkoutUi.field}
          />
        </div>

        <div>
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-address-1">
            Address
          </label>
          <input
            id="checkout-address-1"
            type="text"
            autoComplete="address-line1"
            placeholder="Street and building"
            value={value.addressLine1}
            onChange={(e) => patch({ addressLine1: e.target.value })}
            className={checkoutUi.field}
          />
        </div>

        <div>
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-address-2">
            Apartment
          </label>
          <input
            id="checkout-address-2"
            type="text"
            autoComplete="address-line2"
            placeholder="Suite (optional)"
            value={value.addressLine2}
            onChange={(e) => patch({ addressLine2: e.target.value })}
            className={checkoutUi.field}
          />
        </div>

        <div>
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-city">
            City
          </label>
          <input
            id="checkout-city"
            type="text"
            autoComplete="address-level2"
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            className={checkoutUi.field}
          />
        </div>

        <div>
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-pin">
            PIN
          </label>
          <input
            id="checkout-pin"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={value.pin}
            onChange={(e) =>
              patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) })
            }
            className={cn(
              checkoutUi.field,
              pinInvalid && "border-[var(--settings-danger)]",
            )}
            aria-invalid={pinInvalid}
          />
          {pinInvalid && (
            <p className={cn(checkoutUi.errorText, "mt-1")}>PIN must be 6 digits</p>
          )}
        </div>

        <div>
          <label className={checkoutUi.fieldLabel} htmlFor="checkout-state">
            State
          </label>
          <div className="relative">
            <select
              id="checkout-state"
              value={value.state}
              onChange={(e) => patch({ state: e.target.value })}
              className={cn(checkoutUi.fieldWithTrailingIcon, "appearance-none")}
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
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
              strokeWidth={1.75}
            />
          </div>
        </div>

        <div>
          <p className={checkoutUi.fieldLabel}>Country</p>
          <p className="flex h-9 items-center text-[14px] leading-5 text-[var(--settings-fg)]">
            India
          </p>
        </div>
      </div>
    </section>
  );
}

export function checkoutAddressToBillingLine(
  state: CheckoutAddressState,
): string {
  return composeAddressLine(state) || "India";
}
