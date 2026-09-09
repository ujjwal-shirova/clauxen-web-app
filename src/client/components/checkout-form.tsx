"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
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
import { CheckoutRazorpayTrust } from "@/components/checkout-razorpay-trust";
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
  paymentMobile?: string;
  onPaymentMobileChange?: (value: string) => void;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
  billingAddress: CheckoutAddressState;
  onBillingAddressChange: (state: CheckoutAddressState) => void;
  /** When true, show compact address summary instead of the full form. */
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
      data-checkout-form=""
      className={checkoutUi.form}
      onSubmit={(e) => {
        e.preventDefault();
        onPay();
      }}
    >
      <div
        className={cn(
          checkoutUi.stack,
          "max-lg:pb-[calc(6.75rem+env(safe-area-inset-bottom))]",
        )}
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

        <div className={checkoutUi.section}>
          <label className="flex cursor-pointer items-center gap-2.5">
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
            <div className="flex animate-in fade-in slide-in-from-top-1 flex-col gap-3 duration-200">
              <div>
                <label className={checkoutUi.fieldLabel} htmlFor="checkout-business-name">
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
                  <p className={cn(checkoutUi.errorText, "mt-1 px-0.5")}>
                    {gstinError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={checkoutUi.section}>
          <label className="flex cursor-pointer items-start gap-2.5">
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
      </div>

      <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-[var(--settings-hairline)] max-lg:bg-[var(--settings-canvas-bg,var(--app-panel-bg,#fcfcfb))] max-lg:px-3 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-10px_28px_-18px_rgba(24,24,27,0.4)]">
        <button
          type="submit"
          disabled={payDisabled}
          onPointerDown={() => {
            if (!payDisabled) onPayPrepare?.();
          }}
          className={cn(
            appBtn.primaryLg,
            "no-hover-overlay w-full !h-12 !min-h-[3rem] !text-[15px]",
            payDisabled && "cursor-not-allowed opacity-50",
          )}
        >
          {paying ? "Processing…" : payLabel}
        </button>

        <CheckoutRazorpayTrust className="pt-2" />

        {payDisabled && payDisabledReason && !paying && (
          <p className={cn(checkoutUi.errorText, "pt-2 text-center")}>
            {payDisabledReason}
          </p>
        )}

        {variablePlanNotice && (
          <p className={cn(checkoutUi.labelFine, "pt-2 text-center")}>
            {variablePlanNotice}
          </p>
        )}
      </div>
    </form>
  );
}
