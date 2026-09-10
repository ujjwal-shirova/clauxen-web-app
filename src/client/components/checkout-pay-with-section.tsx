"use client";

import "bootstrap-icons/font/bootstrap-icons.css";
import React from "react";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { CheckoutOrDivider } from "@/components/checkout-or-divider";
import { CheckoutPayWithLinkButton } from "@/components/checkout-pay-with-link";
import {
  CheckoutPaymentPanel,
  type CheckoutCardFieldState,
  type CheckoutNetbankingFieldState,
} from "@/components/checkout-payment-panel";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import { checkoutUi } from "@/lib/checkout-ui";
import { CHECKOUT_UPI_ICON_URL } from "@/lib/checkout-payment-icons";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="checkout-segment__item no-hover-overlay no-hover"
    >
      {children}
    </button>
  );
}

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
  onLinkPay,
  linkPayDisabled = false,
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
  onLinkPay?: () => void;
  linkPayDisabled?: boolean;
}) {
  const showSaved = Boolean(savedMethod);

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className={checkoutUi.sectionTitle}>Payment Method</h2>

      <CheckoutPayWithLinkButton
        onClick={() => {
          onPaymentTabChange("link");
          onLinkPay?.();
        }}
        disabled={linkPayDisabled}
      />
      <CheckoutOrDivider />

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

      <div role="radiogroup" aria-label="Payment method" className="checkout-segment">
        {showSaved && (
          <TabButton
            selected={paymentTab === "saved"}
            onClick={() => onPaymentTabChange("saved")}
          >
            <Wallet className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 truncate">Saved</span>
          </TabButton>
        )}
        <TabButton
          selected={paymentTab === "card"}
          onClick={() => onPaymentTabChange("card")}
        >
          <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 truncate">Card</span>
        </TabButton>
        {!hideUpi && (
          <TabButton
            selected={paymentTab === "upi"}
            onClick={() => onPaymentTabChange("upi")}
          >
            <CheckoutPaymentIcon
              src={CHECKOUT_UPI_ICON_URL}
              alt=""
              className="h-4 w-7 shrink-0 rounded-[3px]"
            />
            <span className="min-w-0 truncate">UPI</span>
          </TabButton>
        )}
        {!hideNetbanking && (
          <TabButton
            selected={paymentTab === "netbanking"}
            onClick={() => onPaymentTabChange("netbanking")}
          >
            <Landmark className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 truncate">Netbanking</span>
          </TabButton>
        )}
      </div>

      <CheckoutPaymentPanel
        tab={paymentTab}
        savedMethod={savedMethod}
        onCardFieldsChange={onCardFieldsChange}
        onNetbankingChange={onNetbankingChange}
      />
    </section>
  );
}
