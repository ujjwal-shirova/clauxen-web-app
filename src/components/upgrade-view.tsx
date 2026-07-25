"use client";

import React, { useCallback, useState } from "react";
import UpgradePageContent from "./subscription";
import type { MaxTier } from "./billing-checkout";
import { BillingCheckout } from "./billing-checkout";
import { InvoiceView, type InvoiceData } from "./invoice-view";
import { PaymentSuccessDialog } from "./payment-success-dialog";
import { FullscreenPortal } from "./fullscreen-portal";
import {
  billingInvoicePdfUrl,
  getBillingInvoice,
} from "@/lib/api/billing";

interface UpgradeViewProps {
  onClose: () => void;
}

type BillingCycle = "monthly" | "yearly";
type ViewState = "plans" | "checkout" | "invoice" | "success";

export function UpgradeView({ onClose }: UpgradeViewProps) {
  const [currentView, setCurrentView] = useState<ViewState>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>("monthly");
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>("5x");
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const resetToPlans = () => {
    setCurrentView("plans");
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setInvoiceData(null);
    setLastPaymentId(null);
  };

  const handleSelectPlan = useCallback(
    (
      planId: string,
      billingCycle: BillingCycle,
      maxTier?: MaxTier,
      planDisplayName?: string,
    ) => {
      setSelectedPlanId(planId);
      setSelectedBillingCycle(billingCycle);
      if (maxTier) setSelectedMaxTier(maxTier);
      setSelectedPlanName(planDisplayName || planId);
      setCurrentView("checkout");
    },
    [],
  );

  const handleBackToPlans = () => {
    resetToPlans();
  };

  const handlePaymentSuccess = async (details?: {
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }) => {
    const paymentId = details?.razorpayPaymentId;
    if (paymentId) {
      setLastPaymentId(paymentId);
      // Prefetch invoice in background; success card is the primary UX.
      void (async () => {
        for (let i = 0; i < 6; i++) {
          try {
            const res = await getBillingInvoice(paymentId);
            setInvoiceData({
              ...res.invoice,
              paymentId,
              pdfAvailable: Boolean(res.pdfKey),
            });
            return;
          } catch {
            await new Promise((r) => window.setTimeout(r, 400 * (i + 1)));
          }
        }
      })();
    }
    setPlansRefreshKey((k) => k + 1);
    setCurrentView("success");
  };

  const handleSuccessContinue = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clauxen:billing-updated"));
      onClose();
      window.location.href = "/new?checkout=success";
      return;
    }
    onClose();
  };

  const handleInvoiceClose = () => {
    resetToPlans();
    onClose();
  };

  const handleInvoiceDownload = () => {
    const paymentId =
      invoiceData?.paymentId ||
      invoiceData?.razorpayPaymentId ||
      lastPaymentId;
    if (paymentId) {
      window.open(billingInvoicePdfUrl(paymentId), "_blank", "noopener");
      return;
    }
    window.print();
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-[var(--app-shell-bg)] [scrollbar-gutter:stable]">
        {currentView === "plans" && (
          <UpgradePageContent
            key={plansRefreshKey}
            onClose={onClose}
            onSelectPlan={(planId, cycle, tier, name) =>
              handleSelectPlan(planId, cycle, tier, name)
            }
          />
        )}

        {currentView === "checkout" && selectedPlanId && (
          <BillingCheckout
            onBack={handleBackToPlans}
            onPaymentSuccess={handlePaymentSuccess}
            planId={selectedPlanId}
            initialBillingCycle={selectedBillingCycle}
            initialMaxTier={selectedMaxTier}
          />
        )}

        {currentView === "invoice" && invoiceData && (
          <InvoiceView
            data={invoiceData}
            onClose={handleInvoiceClose}
            onDownload={handleInvoiceDownload}
          />
        )}

        {currentView === "success" && (
          <PaymentSuccessDialog
            open
            planName={selectedPlanName}
            onGetStarted={handleSuccessContinue}
          />
        )}
      </div>
    </FullscreenPortal>
  );
}
