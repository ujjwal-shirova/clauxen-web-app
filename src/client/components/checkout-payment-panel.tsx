"use client";

import React, { useMemo, useState } from "react";
import { Check, CreditCard, Landmark, MoreHorizontal, Search } from "lucide-react";
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
  /** Digits as typed; normalized to +91… at charge time. */
  mobile: string;
  isComplete: boolean;
};

function formatIndianMobileInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function CheckoutMobileField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label
        className={checkoutUi.fieldLabel}
        htmlFor="checkout-mobile-number"
      >
        Mobile number
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--settings-fg-muted)]">
          +91
        </span>
        <input
          id="checkout-mobile-number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit mobile number"
          value={value}
          onChange={(e) => onChange(formatIndianMobileInput(e.target.value))}
          className={cn(checkoutUi.field, "pl-12")}
          aria-label="Mobile number"
        />
      </div>
      {hint ? (
        <p className="mt-1.5 px-0.5 text-[12px] leading-4 text-[var(--settings-fg-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function NetbankingBankPanel({
  paymentMobile,
  onPaymentMobileChange,
  onNetbankingChange,
}: {
  paymentMobile: string;
  onPaymentMobileChange?: (value: string) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const popular = useMemo(() => listPopularNetbankingBanks(), []);
  const banks = useMemo(() => filterNetbankingBanks(query), [query]);

  React.useEffect(() => {
    const mobileOk = /^[6-9]\d{9}$/.test(paymentMobile);
    onNetbankingChange?.({
      bankCode: selectedCode,
      mobile: paymentMobile,
      isComplete: Boolean(selectedCode) && mobileOk,
    });
  }, [selectedCode, paymentMobile, onNetbankingChange]);

  const selectBank = (code: string) => {
    setSelectedCode(code);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="px-0.5 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
        You sign in on your bank&apos;s page. We never see your password.
      </p>

      <CheckoutMobileField
        value={paymentMobile}
        onChange={(value) => onPaymentMobileChange?.(value)}
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--settings-fg-subtle)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search banks"
          autoComplete="off"
          className={cn(checkoutUi.field, "pl-9")}
          aria-label="Search banks"
        />
      </div>

      {!query.trim() && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Popular banks">
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
                  "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
                  selected
                    ? "border-[hsl(var(--brand))] bg-[var(--brand-soft)] text-[var(--settings-fg)]"
                    : "border-[var(--settings-input-border)] bg-[var(--settings-card-bg)] text-[var(--settings-fg-muted)] hover:border-[var(--settings-input-focus)] hover:text-[var(--settings-fg)]",
                )}
              >
                {bank.name}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="settings-card max-h-[220px] overflow-y-auto"
        role="listbox"
        aria-label="Banks"
      >
        {banks.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-[var(--settings-fg-muted)]">
            No banks match “{query.trim()}”.
          </div>
        ) : (
          banks.map((bank, index) => {
            const selected = selectedCode === bank.code;
            return (
              <button
                key={bank.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectBank(bank.code)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] transition-colors duration-100",
                  index > 0 && "border-t border-[var(--settings-hairline)]",
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
  );
}

export function CheckoutPaymentPanel({
  tab,
  savedMethod,
  paymentMobile = "",
  onPaymentMobileChange,
  onCardFieldsChange,
  onNetbankingChange,
}: {
  tab: CheckoutPaymentTab;
  savedMethod: SavedPaymentMethod | null;
  /** Shared +91 mobile used by card, netbanking, and UPI (Razorpay requires contact). */
  paymentMobile?: string;
  onPaymentMobileChange?: (value: string) => void;
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
            className="h-8 w-11 rounded-[5px] border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] p-0.5"
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
      <CheckoutMobileField
        value={paymentMobile}
        onChange={(value) => onPaymentMobileChange?.(value)}
        hint="A QR code appears after you continue."
      />
    );
  }

  if (tab === "netbanking") {
    return (
      <NetbankingBankPanel
        paymentMobile={paymentMobile}
        onPaymentMobileChange={onPaymentMobileChange}
        onNetbankingChange={onNetbankingChange}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <CheckoutMobileField
        value={paymentMobile}
        onChange={(value) => onPaymentMobileChange?.(value)}
      />
      <div>
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
      <div className="grid grid-cols-2 gap-3">
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
              placeholder="CVC"
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
    </div>
  );
}
