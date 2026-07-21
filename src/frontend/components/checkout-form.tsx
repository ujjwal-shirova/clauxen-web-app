"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import { CheckoutPayWithSection } from "@/frontend/components/checkout-pay-with-section";
import type {
  CheckoutCardFieldState,
  CheckoutNetbankingFieldState,
} from "@/frontend/components/checkout-payment-panel";
import {
  CheckoutBillingAddress,
  type CheckoutAddressState,
} from "@/frontend/components/checkout-billing-address";
import { CheckoutQrHint } from "@/frontend/components/checkout-qr-hint";
import { CheckoutRazorpayTrust } from "@/frontend/components/checkout-razorpay-trust";
import { checkoutUi } from "@/frontend/lib/checkout-ui";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";

export type CheckoutFormProps = {
  paymentTab: CheckoutPaymentTab;
  onPaymentTabChange: (tab: CheckoutPaymentTab) => void;
  savedMethod: SavedPaymentMethod | null;
  purchasingAsBusiness: boolean;
  onPurchasingAsBusinessChange: (value: boolean) => void;
  gstin: string;
  onGstinChange: (value: string) => void;
  gstinError: string | null;
  onGstinBlur: () => void;
  billToName: string;
  onBillToNameChange: (value: string) => void;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  paying: boolean;
  payDisabled: boolean;
  /** Shown under the Pay button when disabled so users know what's missing. */
  payDisabledReason?: string | null;
  payLabel: string;
  variablePlanNotice?: string | null;
  onPay: () => void;
  /** Fires on Pay button pointer down — use to warm payment SDKs before click completes. */
  onPayPrepare?: () => void;
  showExpressCheckout?: boolean;
  hideUpi?: boolean;
  hideNetbanking?: boolean;
  onExpressCheckout?: () => void;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
  billingAddress: CheckoutAddressState;
  onBillingAddressChange: (state: CheckoutAddressState) => void;
};

export function CheckoutForm({
  paymentTab,
  onPaymentTabChange,
  savedMethod,
  purchasingAsBusiness,
  onPurchasingAsBusinessChange,
  gstin,
  onGstinChange,
  gstinError,
  onGstinBlur,
  billToName,
  onBillToNameChange,
  agreed,
  onAgreedChange,
  paying,
  payDisabled,
  payDisabledReason = null,
  payLabel,
  variablePlanNotice,
  onPay,
  onPayPrepare,
  showExpressCheckout = false,
  hideUpi = false,
  hideNetbanking = false,
  onExpressCheckout,
  onCardFieldsChange,
  onNetbankingChange,
  billingAddress,
  onBillingAddressChange,
}: CheckoutFormProps) {
  const isUpi = paymentTab === "upi";

  return (
    <form
      className={checkoutUi.form}
      onSubmit={(e) => {
        e.preventDefault();
        onPay();
      }}
    >
      <div className={checkoutUi.stack}>
        <CheckoutPayWithSection
          paymentTab={paymentTab}
          onPaymentTabChange={onPaymentTabChange}
          savedMethod={savedMethod}
          showExpressCheckout={showExpressCheckout}
          hideUpi={hideUpi}
          hideNetbanking={hideNetbanking}
          onExpressCheckout={onExpressCheckout}
          onCardFieldsChange={onCardFieldsChange}
          onNetbankingChange={onNetbankingChange}
        />

        {isUpi && (
          <div className="flex flex-col gap-3">
            <CheckoutQrHint />
            <CheckoutBillingAddress
              value={billingAddress}
              onChange={onBillingAddressChange}
            />
          </div>
        )}

        <div className={checkoutUi.section}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={purchasingAsBusiness}
              onChange={(e) => onPurchasingAsBusinessChange(e.target.checked)}
              className={checkoutUi.checkbox}
            />
            <span className={checkoutUi.labelMuted}>
              I&apos;m purchasing as business
            </span>
          </label>

          {purchasingAsBusiness && (
            <div className="flex animate-in fade-in slide-in-from-top-1 flex-col gap-3 duration-200">
              <input
                type="text"
                value={billToName}
                onChange={(e) => onBillToNameChange(e.target.value)}
                placeholder="Business name"
                className={checkoutUi.field}
              />
              <input
                type="text"
                value={gstin}
                onChange={(e) => onGstinChange(e.target.value.toUpperCase())}
                onBlur={onGstinBlur}
                placeholder="GSTIN"
                className={cn(checkoutUi.field, "uppercase")}
              />
              {gstinError && (
                <p className={checkoutUi.errorText}>{gstinError}</p>
              )}
            </div>
          )}
        </div>

        <div className={checkoutUi.section}>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => onAgreedChange(e.target.checked)}
              className={cn(checkoutUi.checkbox, "mt-0.5")}
            />
            <span className={checkoutUi.labelFine}>
              You agree that Shirova will charge your payment method for this
              purchase and on a recurring basis until you cancel.
            </span>
          </label>

          <button
            type="submit"
            disabled={payDisabled}
            onPointerDown={() => {
              if (!payDisabled) onPayPrepare?.();
            }}
            className={cn(
              payDisabled ? checkoutUi.payDisabled : appBtn.primaryLg,
            )}
          >
            {paying ? "Processing…" : payLabel}
          </button>

          <CheckoutRazorpayTrust className="pt-0.5" />

          {payDisabled && payDisabledReason && !paying && (
            <p className={cn(checkoutUi.labelFine, "text-center text-[#911E1B]")}>
              {payDisabledReason}
            </p>
          )}

          {variablePlanNotice && (
            <p className={cn(checkoutUi.labelFine, "text-center")}>
              {variablePlanNotice}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
