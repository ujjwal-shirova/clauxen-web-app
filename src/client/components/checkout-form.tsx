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
        </div>
      </div>

      <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:border-t max-lg:border-zinc-200/80 max-lg:bg-[var(--settings-canvas-bg,var(--app-panel-bg,#fcfcfb))] max-lg:px-3 max-lg:pt-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-10px_28px_-18px_rgba(24,24,27,0.4)]">
        <button
          type="submit"
          disabled={payDisabled}
          onPointerDown={() => {
            if (!payDisabled) onPayPrepare?.();
          }}
          className={cn(
            "no-hover-overlay inline-flex h-12 min-h-[48px] w-full items-center justify-center rounded-[var(--radius-sm)] px-5 text-[15px] font-medium leading-5 transition-[background-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14151a]/30 sm:h-11 sm:min-h-[44px] sm:text-[14px]",
            payDisabled
              ? "cursor-not-allowed bg-[#e2e4e9] text-[#71717a]"
              : "cursor-pointer bg-[#14151a] text-[#ffffff] shadow-[0_1px_2px_rgba(20,21,26,0.18)] hover:bg-[#27272a] hover:shadow-[0_3px_8px_rgba(20,21,26,0.18)] active:bg-[#09090b]",
          )}
        >
          {paying ? "Processing…" : payLabel}
        </button>

        <CheckoutRazorpayTrust className="pt-2" />

        {payDisabled && payDisabledReason && !paying && (
          <p className={cn(checkoutUi.labelFine, "pt-2 text-center text-[#911E1B]")}>
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
