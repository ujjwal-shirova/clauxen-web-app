"use client";

import React, { useState } from "react";
import { CreditCard, Smartphone } from "lucide-react";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import {
  CheckoutMobileField,
  CheckoutPaymentPanel,
  type CheckoutCardFieldState,
} from "@/components/checkout-payment-panel";
import { CheckoutRazorpayTrust } from "@/components/checkout-razorpay-trust";
import {
  startPaymentMethodSetup,
  verifyPaymentMethodSetup,
} from "@/lib/api/billing";
import {
  chargeCardWithRazorpayCustom,
  normalizeIndianMobileContact,
} from "@/lib/razorpay-custom-checkout";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { useAuth } from "@/hooks/use-auth";
import { checkoutUi } from "@/lib/checkout-ui";
import { cn } from "@/lib/utils";
import { SettingsPillButton } from "@/components/settings/settings-ui";

type MethodKind = "card" | "upi";

export function AddPaymentMethodDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const [kind, setKind] = useState<MethodKind>("card");
  const [paymentMobile, setPaymentMobile] = useState("");
  const [cardFields, setCardFields] = useState<CheckoutCardFieldState>({
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    isComplete: false,
  });
  const [upiVpa, setUpiVpa] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleAuthorize = async () => {
    setError(null);
    setBusy(true);
    try {
      const contact = normalizeIndianMobileContact(paymentMobile);
      if (!contact) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const { setup } = await startPaymentMethodSetup({
        method: kind,
        contact,
      });

      if (kind === "card") {
        if (!cardFields.isComplete) {
          throw new Error("Enter a complete card number, expiry, and CVC.");
        }
        const cardFirst4 = cardFields.cardNumber.replace(/\D/g, "").slice(0, 4);
        await chargeCardWithRazorpayCustom({
          keyId: setup.keyId,
          orderId: setup.orderId,
          amount: 0,
          currency: "INR",
          allowZeroAmount: true,
          customerId: setup.customerId,
          saveInstrument: true,
          email: auth.user?.email ?? undefined,
          contact,
          description: "Securely save payment method · ₹0 authorization",
          card: {
            number: cardFields.cardNumber,
            name: auth.user?.displayName || "Customer",
            expiry: cardFields.cardExpiry,
            cvc: cardFields.cardCvc,
          },
          onSuccess: async (payment) => {
            await verifyPaymentMethodSetup({
              method: "card",
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
              cardFirst4,
              customerId: setup.customerId,
            });
            onSaved();
            onClose();
          },
          onFailure: (message) => {
            setError(message || "Could not save card. Please try again.");
          },
        });
        return;
      }

      // UPI Autopay mandate — ₹0 charge, ₹25,000 ceiling.
      const vpa = upiVpa.trim().toLowerCase();
      if (!/^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i.test(vpa)) {
        throw new Error("Enter a valid UPI ID (for example name@okaxis).");
      }

      await openRazorpayCheckout({
        keyId: setup.keyId,
        orderId: setup.orderId,
        amount: 0,
        currency: "INR",
        allowZeroAmount: true,
        name: "Clauxen",
        description: "UPI Autopay setup · ₹0 authorization",
        paymentMethod: "upi",
        prefill: {
          email: auth.user?.email ?? undefined,
          name: auth.user?.displayName ?? undefined,
          contact,
        },
        onSuccess: async (payment) => {
          await verifyPaymentMethodSetup({
            method: "upi",
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
            upiVpa: vpa,
            customerId: setup.customerId,
          });
          onSaved();
          onClose();
        },
        onDismiss: () => {
          setError("UPI setup was cancelled.");
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullscreenPortal>
      <div
        className="settings-theme fixed inset-0 z-[210] flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Add payment method"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose();
        }}
      >
        <div className="w-full max-w-[520px] rounded-[18px] border border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] p-6 text-[var(--settings-fg)] shadow-[var(--settings-modal-shadow)]">
          <h3 className="text-[17px] font-semibold text-[var(--settings-fg)]">
            Add payment method
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
            Authorize a ₹25,000 mandate with no charge today. You can use this
            method for future upgrades.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("card")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors",
                kind === "card"
                  ? "border-[var(--settings-fg)] bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                  : "border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)]",
              )}
            >
              <CreditCard className="h-4 w-4" />
              Card
            </button>
            <button
              type="button"
              onClick={() => setKind("upi")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors",
                kind === "upi"
                  ? "border-[var(--settings-fg)] bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                  : "border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)]",
              )}
            >
              <Smartphone className="h-4 w-4" />
              UPI
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {kind === "card" ? (
              <CheckoutPaymentPanel
                tab="card"
                savedMethod={null}
                paymentMobile={paymentMobile}
                onPaymentMobileChange={setPaymentMobile}
                onCardFieldsChange={setCardFields}
              />
            ) : (
              <>
                <CheckoutMobileField
                  value={paymentMobile}
                  onChange={setPaymentMobile}
                />
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="yourname@upi"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  className={checkoutUi.field}
                  aria-label="UPI ID"
                />
              </>
            )}
          </div>

          {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

          <div className="mt-5 flex flex-col gap-3">
            <SettingsPillButton
              variant="primary"
              disabled={busy}
              onClick={() => void handleAuthorize()}
              className="h-11 w-full"
            >
              {busy ? "Authorizing…" : "Authorize · ₹0"}
            </SettingsPillButton>
            <CheckoutRazorpayTrust />
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="text-[13px] font-medium text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}
