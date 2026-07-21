"use client";

import "bootstrap-icons/font/bootstrap-icons.css";
import React from "react";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { CheckoutOrDivider } from "@/frontend/components/checkout-or-divider";
import {
  CheckoutPaymentPanel,
  type CheckoutCardFieldState,
  type CheckoutNetbankingFieldState,
} from "@/frontend/components/checkout-payment-panel";
import { CheckoutPaymentIcon } from "@/frontend/components/checkout-payment-icon";
import { checkoutTabClass, checkoutUi } from "@/frontend/lib/checkout-ui";
import { cn } from "@/frontend/lib/utils";
import { CHECKOUT_UPI_ICON_URL } from "@/lib/checkout-payment-icons";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";

export function CheckoutPayWithSection({
  paymentTab,
  onPaymentTabChange,
  savedMethod,
  showExpressCheckout,
  onExpressCheckout,
  onCardFieldsChange,
  onNetbankingChange,
  hideUpi = false,
  hideNetbanking = false,
}: {
  paymentTab: CheckoutPaymentTab;
  onPaymentTabChange: (tab: CheckoutPaymentTab) => void;
  savedMethod: SavedPaymentMethod | null;
  showExpressCheckout?: boolean;
  hideUpi?: boolean;
  hideNetbanking?: boolean;
  onExpressCheckout?: () => void;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
}) {
  const showSaved = Boolean(savedMethod);
  const tabCount =
    (showSaved ? 1 : 0) +
    (hideNetbanking ? 0 : 1) +
    1 +
    (hideUpi ? 0 : 1);

  return (
    <div className={checkoutUi.section}>
      <h3 className={checkoutUi.sectionTitle}>Pay with</h3>

      {showExpressCheckout && (
        <>
          <button
            type="button"
            onClick={onExpressCheckout}
            className={checkoutUi.expressButton}
          >
            <i className="bi bi-apple text-[22px] leading-none" aria-hidden />
            Apple Pay
          </button>
          <CheckoutOrDivider />
        </>
      )}

      <div
        className={cn(
          "grid gap-2",
          tabCount === 1 && "grid-cols-1",
          tabCount === 2 && "grid-cols-2",
          tabCount === 3 && "grid-cols-3",
          tabCount >= 4 && "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {showSaved && (
          <button
            type="button"
            onClick={() => onPaymentTabChange("saved")}
            className={checkoutTabClass(paymentTab === "saved")}
          >
            <Wallet className="h-4 w-4" strokeWidth={1.75} />
            <span>Saved</span>
          </button>
        )}

        {!hideNetbanking && (
          <button
            type="button"
            onClick={() => onPaymentTabChange("netbanking")}
            className={checkoutTabClass(paymentTab === "netbanking")}
          >
            <Landmark className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-center leading-tight">Net Banking</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onPaymentTabChange("card")}
          className={checkoutTabClass(paymentTab === "card")}
        >
          <CreditCard className="h-4 w-4" strokeWidth={1.75} />
          <span>Card</span>
        </button>

        {!hideUpi && (
          <button
            type="button"
            onClick={() => onPaymentTabChange("upi")}
            className={checkoutTabClass(paymentTab === "upi")}
          >
            <CheckoutPaymentIcon
              src={CHECKOUT_UPI_ICON_URL}
              alt="UPI"
              className="h-5 w-8 rounded-[3px]"
            />
            <span>UPI</span>
          </button>
        )}
      </div>

      <CheckoutPaymentPanel
        tab={paymentTab}
        savedMethod={savedMethod}
        onCardFieldsChange={onCardFieldsChange}
        onNetbankingChange={onNetbankingChange}
      />
    </div>
  );
}
