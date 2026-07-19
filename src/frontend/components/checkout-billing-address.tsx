"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { apiFetch } from "@/frontend/lib/api/client";
import { checkoutUi } from "@/frontend/lib/checkout-ui";
import { cn } from "@/frontend/lib/utils";
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

type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
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

export function CheckoutBillingAddress({
  value,
  onChange,
  showExpanded,
  onExpand,
}: {
  value: CheckoutAddressState;
  onChange: (next: CheckoutAddressState) => void;
  showExpanded: boolean;
  onExpand: () => void;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const patch = useCallback(
    (partial: Partial<CheckoutAddressState>) => {
      const next = { ...value, ...partial };
      next.isComplete = isCheckoutAddressComplete(next);
      onChange(next);
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!showExpanded) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showExpanded]);

  useEffect(() => {
    if (!showExpanded) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = value.addressLine1.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await apiFetch<{ suggestions: PlaceSuggestion[] }>(
            "/api/v1/billing/places/autocomplete",
            {
              method: "POST",
              body: JSON.stringify({ input: q }),
            },
          );
          setSuggestions(res.suggestions ?? []);
          setOpen((res.suggestions ?? []).length > 0);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value.addressLine1, showExpanded]);

  const selectSuggestion = async (s: PlaceSuggestion) => {
    setOpen(false);
    try {
      const res = await apiFetch<{
        address: {
          addressLine1: string;
          addressLine2: string;
          city: string;
          state: string;
          pin: string;
          countryCode: string;
        };
      }>("/api/v1/billing/places/details", {
        method: "POST",
        body: JSON.stringify({ placeId: s.placeId }),
      });
      const a = res.address;
      patch({
        addressLine1: a.addressLine1 || s.mainText,
        addressLine2: a.addressLine2 || "",
        city: a.city || "",
        state: a.state || "",
        pin: (a.pin || "").replace(/\D/g, "").slice(0, 6),
        countryCode: a.countryCode || "IN",
      });
    } catch {
      patch({ addressLine1: s.mainText });
    }
  };

  const pinInvalid =
    value.pin.length > 0 && !/^\d{6}$/.test(value.pin.trim());

  return (
    <div className="flex flex-col gap-3">
      {!showExpanded && (
        <input
          type="text"
          autoComplete="name"
          placeholder="Full name"
          value={value.fullName}
          onChange={(e) => patch({ fullName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.fullName.trim().length >= 2) onExpand();
            }
          }}
          onBlur={() => {
            if (value.fullName.trim().length >= 2) onExpand();
          }}
          className={checkoutUi.field}
        />
      )}

      {showExpanded && (
        <div className="flex animate-in fade-in slide-in-from-top-1 flex-col gap-3 duration-200">
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

          <div ref={wrapRef} className="relative">
            <input
              type="text"
              autoComplete="address-line1"
              placeholder="Address line 1"
              value={value.addressLine1}
              onChange={(e) => {
                patch({ addressLine1: e.target.value });
                setOpen(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setOpen(true);
              }}
              className={cn(
                checkoutUi.field,
                open &&
                  "border-[#121212] shadow-none focus:border-[#121212] focus:shadow-none",
              )}
            />

            {open && (
              <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[10px] border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
                  <span className="text-[11px] text-zinc-500">
                    Suggestions powered by{" "}
                    <span className="font-medium text-zinc-700">Google</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Close suggestions"
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="max-h-56 overflow-y-auto py-1">
                  {loading && (
                    <li className="px-3 py-2 text-sm text-zinc-500">
                      Searching…
                    </li>
                  )}
                  {!loading &&
                    suggestions.map((s) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
                          onClick={() => void selectSuggestion(s)}
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-zinc-900">
                              {s.mainText}
                            </span>{" "}
                            <span className="text-zinc-500">
                              {s.secondaryText}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  {!loading &&
                    suggestions.length === 0 &&
                    value.addressLine1.trim().length >= 2 && (
                      <li className="px-3 py-2 text-sm text-zinc-500">
                        Keep typing, or fill the fields below manually
                      </li>
                    )}
                </ul>
              </div>
            )}
          </div>

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
      )}
    </div>
  );
}

export function checkoutAddressToBillingLine(
  state: CheckoutAddressState,
): string {
  return composeAddressLine(state) || "India";
}
