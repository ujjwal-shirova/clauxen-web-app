"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckoutPayWithSection } from "@/components/checkout-pay-with-section";
import type {
  CheckoutCardFieldState,
  CheckoutNetbankingFieldState,
} from "@/components/checkout-payment-panel";
import {
  CheckoutBillingAddress,
  type CheckoutAddressState,
} from "@/components/checkout-billing-address";
import { CheckoutBillingAddressSummary } from "@/components/checkout-billing-address-summary";
import { CheckoutQrHint } from "@/components/checkout-qr-hint";
import {
  CHECKOUT_FORM_ID,
  CheckoutPayCta,
} from "@/components/checkout-pay-cta";
import { checkoutUi } from "@/lib/checkout-ui";
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
  payDisabledReason?: string | null;
  payLabel: string;
  variablePlanNotice?: string | null;
  onPay: () => void;
  onPayPrepare?: () => void;
  showExpressCheckout?: boolean;
  hideUpi?: boolean;
  hideNetbanking?: boolean;
  onExpressCheckout?: () => void;
  paymentMobile?: string;
  onPaymentMobileChange?: (value: string) => void;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
  billingAddress: CheckoutAddressState;
  onBillingAddressChange: (state: CheckoutAddressState) => void;
  billingAddressCollapsed?: boolean;
  onEditBillingAddress?: () => void;
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
  paymentMobile,
  onPaymentMobileChange,
  onCardFieldsChange,
  onNetbankingChange,
  billingAddress,
  onBillingAddressChange,
  billingAddressCollapsed = false,
  onEditBillingAddress,
}: CheckoutFormProps) {
  const isUpi = paymentTab === "upi";

  return (
    <form
      id={CHECKOUT_FORM_ID}
      data-checkout-form=""
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        onPay();
      }}
    >
      <CheckoutPayWithSection
        paymentTab={paymentTab}
        onPaymentTabChange={onPaymentTabChange}
        savedMethod={savedMethod}
        showExpressCheckout={showExpressCheckout}
        hideUpi={hideUpi}
        hideNetbanking={hideNetbanking}
        onExpressCheckout={onExpressCheckout}
        paymentMobile={paymentMobile}
        onPaymentMobileChange={onPaymentMobileChange}
        onCardFieldsChange={onCardFieldsChange}
        onNetbankingChange={onNetbankingChange}
      />

      <div className="flex flex-col gap-3">
        {isUpi && <CheckoutQrHint />}
        {billingAddressCollapsed && billingAddress.isComplete ? (
          <CheckoutBillingAddressSummary
            address={billingAddress}
            onEdit={() => onEditBillingAddress?.()}
          />
        ) : (
          <CheckoutBillingAddress
            value={billingAddress}
            onChange={onBillingAddressChange}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <label className="checkout-check">
          <input
            type="checkbox"
            checked={purchasingAsBusiness}
            onChange={(e) => onPurchasingAsBusinessChange(e.target.checked)}
            className={checkoutUi.checkbox}
          />
          <span className="text-[13px] font-medium leading-5 text-[var(--settings-fg)]">
            Buying for a business
          </span>
        </label>

        {purchasingAsBusiness && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                className={checkoutUi.fieldLabel}
                htmlFor="checkout-business-name"
              >
                Business name
              </label>
              <input
                id="checkout-business-name"
                type="text"
                value={billToName}
                onChange={(e) => onBillToNameChange(e.target.value)}
                placeholder="Business name"
                className={checkoutUi.field}
              />
            </div>
            <div>
              <label className={checkoutUi.fieldLabel} htmlFor="checkout-gstin">
                GSTIN
              </label>
              <input
                id="checkout-gstin"
                type="text"
                value={gstin}
                onChange={(e) => onGstinChange(e.target.value.toUpperCase())}
                onBlur={onGstinBlur}
                placeholder="15-character GSTIN"
                className={cn(checkoutUi.field, "uppercase")}
              />
              {gstinError && (
                <p className={cn(checkoutUi.errorText, "mt-1")}>{gstinError}</p>
              )}
            </div>
          </div>
        )}

        <label className="checkout-check">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            className={cn(checkoutUi.checkbox, "mt-0.5")}
          />
          <span className={checkoutUi.labelFine}>
            I agree to automatic renewal until I cancel. I can cancel anytime
            from Billing.
          </span>
        </label>
      </div>

      <div className="checkout-pay-dock checkout-pay-dock--mobile">
        <CheckoutPayCta
          paying={paying}
          payDisabled={payDisabled}
          payLabel={payLabel}
          payDisabledReason={payDisabledReason}
          variablePlanNotice={variablePlanNotice}
          onPayPrepare={onPayPrepare}
        />
      </div>
    </form>
  );
}
