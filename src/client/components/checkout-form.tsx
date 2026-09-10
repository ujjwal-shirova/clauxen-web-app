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
import { CHECKOUT_FORM_ID } from "@/components/checkout-pay-cta";
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
  onPay: () => void;
  onLinkPay?: () => void;
  linkPayDisabled?: boolean;
  showGstin?: boolean;
  showExpressCheckout?: boolean;
  hideUpi?: boolean;
  hideNetbanking?: boolean;
  onExpressCheckout?: () => void;
  onCardFieldsChange?: (state: CheckoutCardFieldState) => void;
  onNetbankingChange?: (state: CheckoutNetbankingFieldState) => void;
  billingAddress: CheckoutAddressState;
  onBillingAddressChange: (state: CheckoutAddressState) => void;
  billingAddressCollapsed?: boolean;
  onEditBillingAddress?: () => void;
  termsLabel?: string;
};

function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="checkout-legal-link"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

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
  onPay,
  onLinkPay,
  linkPayDisabled = false,
  showGstin = true,
  showExpressCheckout = false,
  hideUpi = false,
  hideNetbanking = false,
  onExpressCheckout,
  onCardFieldsChange,
  onNetbankingChange,
  billingAddress,
  onBillingAddressChange,
  billingAddressCollapsed = false,
  onEditBillingAddress,
  termsLabel = "This plan auto-renews until I cancel.",
}: CheckoutFormProps) {
  return (
    <form
      id={CHECKOUT_FORM_ID}
      data-checkout-form=""
      className="checkout-form"
      onSubmit={(e) => {
        e.preventDefault();
        onPay();
      }}
    >
      <div className="checkout-form__columns">
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
          onLinkPay={onLinkPay}
          linkPayDisabled={linkPayDisabled}
        />

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

      <div className="checkout-form__footer">
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
          <div className="checkout-form__business">
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
                className={checkoutUi.field}
              />
            </div>
            {showGstin && (
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
            )}
          </div>
        )}

        <label className="checkout-check" htmlFor="checkout-accept-terms">
          <input
            id="checkout-accept-terms"
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            className={cn(checkoutUi.checkbox, "mt-0.5")}
          />
          <span className={checkoutUi.labelFine}>
            I accept Clauxen&apos;s{" "}
            <LegalLink href="/legal/terms">Terms of Service</LegalLink> and{" "}
            <LegalLink href="/legal/privacy">Privacy Policy</LegalLink>
            {termsLabel ? `. ${termsLabel}.` : "."}
          </span>
        </label>
      </div>
    </form>
  );
}
