"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  CHECKOUT_CURRENCIES,
  CHECKOUT_CURRENCY_LABELS,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import { cn } from "@/lib/utils";

export function CheckoutCurrencySelector({
  value,
  onChange,
  className,
}: {
  value: CheckoutCurrency;
  onChange: (currency: CheckoutCurrency) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = CHECKOUT_CURRENCY_LABELS[value];

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 min-w-[108px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-[border,box-shadow] duration-150 hover:border-zinc-300"
      >
        <span className="text-base leading-none" aria-hidden>
          {selected.flag}
        </span>
        <span>{selected.code}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-zinc-500 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Currency"
          className="absolute right-0 z-50 mt-2 w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-[0_12px_32px_rgba(24,24,27,0.12)]"
        >
          {CHECKOUT_CURRENCIES.map((code) => {
            const option = CHECKOUT_CURRENCY_LABELS[code];
            const isSelected = code === value;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[#121212] transition-colors",
                  isSelected ? "bg-zinc-100" : "hover:bg-zinc-50",
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {option.flag}
                </span>
                <span className="font-medium">{option.code}</span>
                {isSelected && (
                  <Check className="ml-auto h-4 w-4 text-zinc-700" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
