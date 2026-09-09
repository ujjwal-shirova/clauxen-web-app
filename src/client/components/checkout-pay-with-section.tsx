"use client";

import "bootstrap-icons/font/bootstrap-icons.css";
import React from "react";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { CheckoutOrDivider } from "@/components/checkout-or-divider";
import {
  CheckoutPaymentPanel,
  type CheckoutCardFieldState,
  type CheckoutNetbankingFieldState,
} from "@/components/checkout-payment-panel";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import { checkoutTabClass, checkoutUi } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";
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
  paymentMobile,
  onPaymentMobileChange,
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
  paymentMobile?: string;
  onPaymentMobileChange?: (value: string) => void;
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
      <div>
        <h3 className={checkoutUi.sectionTitle}>Payment method</h3>
        <p className={cn(checkoutUi.sectionHint, "mt-1")}>
          Encrypted and processed securely.
        </p>
      </div>

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
        role="radiogroup"
        aria-label="Payment method"
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
            role="radio"
            aria-checked={paymentTab === "saved"}
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
            role="radio"
            aria-checked={paymentTab === "netbanking"}
            onClick={() => onPaymentTabChange("netbanking")}
            className={checkoutTabClass(paymentTab === "netbanking")}
          >
            <Landmark className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-center leading-tight">Netbanking</span>
          </button>
        )}

        <button
          type="button"
          role="radio"
          aria-checked={paymentTab === "card"}
          onClick={() => onPaymentTabChange("card")}
          className={checkoutTabClass(paymentTab === "card")}
        >
          <CreditCard className="h-4 w-4" strokeWidth={1.75} />
          <span>Card</span>
        </button>

        {!hideUpi && (
          <button
            type="button"
            role="radio"
            aria-checked={paymentTab === "upi"}
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
        paymentMobile={paymentMobile}
        onPaymentMobileChange={onPaymentMobileChange}
        onCardFieldsChange={onCardFieldsChange}
        onNetbankingChange={onNetbankingChange}
      />
    </div>
  );
}
