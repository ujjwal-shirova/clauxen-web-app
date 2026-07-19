"use client";

import React, { useMemo, useState } from "react";
import { CreditCard, MoreHorizontal } from "lucide-react";
import { CheckoutCardBrandStack } from "@/frontend/components/checkout-card-brand-stack";
import { CheckoutPaymentIcon } from "@/frontend/components/checkout-payment-icon";
import {
  CARD_BRAND_ICONS,
  detectCardBrand,
  getCardBrandStack,
  type CardBrandId,
} from "@/lib/checkout-payment-icons";
import {
  cardNumberDigits,
  formatCardCvc,
  formatCardExpiry,
  formatCardNumber,
} from "@/frontend/lib/card-input-format";
import { checkoutUi } from "@/frontend/lib/checkout-ui";
import { cn } from "@/frontend/lib/utils";
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

export function CheckoutPaymentPanel({
  tab,
  savedMethod,
  onCardFieldsChange,
}: {
  tab: CheckoutPaymentTab;
  savedMethod: SavedPaymentMethod | null;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
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
          No saved payment methods. Use Card to pay securely.
        </div>
      );
    }

    const icon = CARD_BRAND_ICONS[savedMethod.network];

    return (
      <div className={cn(checkoutUi.panel, "flex items-center justify-between")}>
        <div className="flex items-center gap-3">
          <CheckoutPaymentIcon
            src={icon.src}
            alt={icon.label}
            className="h-8 w-11 rounded-[5px] border border-[#e0e0e0] bg-white p-0.5"
          />
          <div>
            <div className="text-sm font-medium text-[#121212]">
              {savedMethod.brand}
            </div>
            <div className="text-sm text-zinc-600">···· {savedMethod.last4}</div>
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
    // Name + QR hint live in CheckoutForm for progressive billing address UX.
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 px-1 text-[11px] font-medium text-zinc-600">
          Card number
        </div>
        <div className="relative">
          <input
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
          <div className="mb-1.5 px-1 text-[11px] font-medium text-zinc-600">
            Expiry date
          </div>
          <input
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
          <div className="mb-1.5 px-1 text-[11px] font-medium text-zinc-600">
            CVC
          </div>
          <div className="relative">
            <input
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
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
