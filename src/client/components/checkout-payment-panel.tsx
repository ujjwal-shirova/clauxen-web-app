"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CreditCard,
  Landmark,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { CheckoutCardBrandStack } from "@/components/checkout-card-brand-stack";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import {
  CARD_BRAND_ICONS,
  CHECKOUT_UPI_ICON_URL,
  detectCardBrand,
  getCardBrandStack,
} from "@/lib/checkout-payment-icons";
import {
  cardNumberDigits,
  formatCardCvc,
  formatCardExpiry,
  formatCardNumber,
} from "@/lib/card-input-format";
import { checkoutUi } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";
import {
  filterNetbankingBanks,
  getNetbankingBankByCode,
  listPopularNetbankingBanks,
} from "@/lib/razorpay-netbanking-banks";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";

export type CheckoutCardFieldState = {
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  isComplete: boolean;
};

export type CheckoutNetbankingFieldState = {
  bankCode: string | null;
  isComplete: boolean;
};

function NetbankingBankPanel({
  onNetbankingChange,
}: {
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = React.useId();
  const popular = useMemo(() => listPopularNetbankingBanks(), []);
  const banks = useMemo(() => filterNetbankingBanks(query), [query]);
  const selectedBank = selectedCode
    ? getNetbankingBankByCode(selectedCode)
    : null;

  React.useEffect(() => {
    onNetbankingChange?.({
      bankCode: selectedCode,
      isComplete: Boolean(selectedCode),
    });
  }, [selectedCode, onNetbankingChange]);

  // Dismiss the popup on outside interaction or page scroll so it never
  // detaches from its anchor.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Element &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const selectBank = (code: string) => {
    setSelectedCode(code);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative" ref={rootRef}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label="Search banks"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={selectedBank ? selectedBank.name : "Search banks"}
          autoComplete="off"
          className={checkoutUi.fieldWithCombo}
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--settings-fg-subtle)] transition-transform duration-150",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
          aria-hidden
        />

        {open && (
          <div className="app-overlay-panel absolute inset-x-0 top-full z-50 mt-2 max-h-[min(20rem,50dvh)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {!query.trim() && (
              <div
                className="flex flex-wrap gap-2 p-3"
                role="radiogroup"
                aria-label="Popular banks"
              >
                {popular.map((bank) => {
                  const selected = selectedCode === bank.code;
                  return (
                    <button
                      key={bank.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectBank(bank.code)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
                        selected
                          ? "bg-[var(--brand-soft)] text-[var(--settings-fg)]"
                          : "bg-[var(--settings-card-bg)] text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
                      )}
                    >
                      {bank.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              id={listboxId}
              className="max-h-56 overflow-y-auto p-1.5"
              role="listbox"
              aria-label="Banks"
            >
              {banks.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-[var(--settings-fg-muted)]">
                  No banks match “{query.trim()}”.
                </div>
              ) : (
                banks.map((bank) => {
                  const selected = selectedCode === bank.code;
                  return (
                    <button
                      key={bank.code}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectBank(bank.code)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13px] transition-colors duration-100",
                        selected
                          ? "bg-[var(--brand-soft)] text-[var(--settings-fg)]"
                          : "text-[var(--settings-fg)] hover:bg-[var(--settings-nav-hover-bg)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          selected
                            ? "bg-[var(--settings-card-bg)] text-[var(--settings-fg)]"
                            : "bg-[var(--settings-icon-bg)] text-[var(--settings-fg-muted)]",
                        )}
                      >
                        <Landmark className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 font-medium leading-5">
                        {bank.name}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedBank && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Selected bank ${selectedBank.name}. Change bank.`}
          className="flex w-full items-center gap-3 rounded-xl bg-[var(--brand-soft)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--settings-card-bg)] text-[var(--settings-fg)]">
            <Landmark className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-[var(--settings-fg)]">
            {selectedBank.name}
          </span>
          <Check className="h-4 w-4 shrink-0 text-[var(--settings-fg)]" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export function CheckoutPaymentPanel({
  tab,
  savedMethod,
  onCardFieldsChange,
  onNetbankingChange,
}: {
  tab: CheckoutPaymentTab;
  savedMethod: SavedPaymentMethod | null;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const digits = cardNumberDigits(cardNumber);
  const detectedBrand = useMemo(() => detectCardBrand(digits), [digits]);
  const brandStack = useMemo(
    () => getCardBrandStack(detectedBrand),
    [detectedBrand],
  );
  const isAmex = detectedBrand === "amex";

  React.useEffect(() => {
    if (!onCardFieldsChange) return;
    const cvcDigits = cardCvc.replace(/\D/g, "");
    const expiryDigits = cardExpiry.replace(/\D/g, "");
    const complete =
      digits.length >= 15 &&
      digits.length <= 19 &&
      expiryDigits.length === 4 &&
      (isAmex ? cvcDigits.length === 4 : cvcDigits.length === 3);

    onCardFieldsChange({
      cardNumber,
      cardExpiry,
      cardCvc,
      isComplete: complete,
    });
  }, [cardNumber, cardExpiry, cardCvc, digits, isAmex, onCardFieldsChange]);

  if (tab === "saved") {
    if (!savedMethod) {
      return (
        <div className={checkoutUi.panelMuted}>
          No saved methods. Pay with a card instead.
        </div>
      );
    }

    const isUpi =
      savedMethod.methodType === "upi" || savedMethod.network === "upi";
    const icon = isUpi
      ? { src: CHECKOUT_UPI_ICON_URL, label: "UPI" }
      : CARD_BRAND_ICONS[
          (savedMethod.network in CARD_BRAND_ICONS
            ? savedMethod.network
            : "visa") as keyof typeof CARD_BRAND_ICONS
        ];

    return (
      <div className={cn(checkoutUi.panel, "flex items-center justify-between")}>
        <div className="flex min-w-0 items-center gap-3">
          <CheckoutPaymentIcon
            src={icon.src}
            alt={icon.label}
            className="h-8 w-11 rounded-[5px] bg-[var(--settings-elevated-bg)] p-0.5"
          />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium leading-5 text-[var(--settings-fg)]">
              {savedMethod.brand}
            </div>
            <div className="truncate text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              {savedMethod.maskedNumber ||
                (isUpi
                  ? savedMethod.upiVpa || "UPI"
                  : savedMethod.first4
                    ? `${savedMethod.first4} •••• •••• ••••`
                    : `•••• •••• •••• ${savedMethod.last4 || "••••"}`)}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={checkoutUi.iconButton}
          aria-label="Payment options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (tab === "upi") {
    return (
      <div className={checkoutUi.panelMuted}>
        Confirm the payment in your UPI app after you click Pay.
      </div>
    );
  }

  if (tab === "netbanking") {
    return <NetbankingBankPanel onNetbankingChange={onNetbankingChange} />;
  }

  return (
    <div className="checkout-card-fields">
      <div className="checkout-card-fields__number">
        <label className={checkoutUi.fieldLabel} htmlFor="checkout-card-number">
          Card number
        </label>
        <div className="relative">
          <input
            id="checkout-card-number"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 1234 1234 1234"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className={checkoutUi.fieldWithIcons}
          />
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <CheckoutCardBrandStack
              brands={brandStack}
              detected={detectedBrand}
            />
          </div>
        </div>
      </div>
      <div>
        <label className={checkoutUi.fieldLabel} htmlFor="checkout-card-expiry">
          Expiry
        </label>
        <input
          id="checkout-card-expiry"
          type="text"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM / YY"
          value={cardExpiry}
          onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
          className={checkoutUi.field}
        />
      </div>
      <div>
        <label className={checkoutUi.fieldLabel} htmlFor="checkout-card-cvc">
          CVC
        </label>
        <div className="relative">
          <input
            id="checkout-card-cvc"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={cardCvc}
            onChange={(e) =>
              setCardCvc(formatCardCvc(e.target.value, isAmex ? 4 : 3))
            }
            className={checkoutUi.fieldWithTrailingIcon}
          />
          <CreditCard
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}
