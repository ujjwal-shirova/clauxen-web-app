"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import UpgradePageContent from "./subscription";
import type { MaxTier } from "./billing-checkout";
import { BillingCheckout } from "./billing-checkout";
import { InvoiceView, type InvoiceData } from "./invoice-view";
import { PaymentSuccessDialog } from "./payment-success-dialog";
import { FullscreenPortal } from "./fullscreen-portal";
import {
  billingInvoicePdfUrl,
  getBillingInvoice,
  getBillingSubscription,
} from "@/lib/api/billing";
import { useOverlaySurfaceFocus } from "@/lib/surface-focus";
import {
  readCachedPlanId,
  writeCachedBillingPlan,
} from "@/lib/billing-plan-cache";

interface UpgradeViewProps {
  onClose: () => void;
}

type BillingCycle = "monthly" | "yearly";
type ViewState = "plans" | "checkout" | "invoice" | "success";

export function UpgradeView({ onClose }: UpgradeViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOverlaySurfaceFocus(surfaceRef);
  const [currentView, setCurrentView] = useState<ViewState>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>("monthly");
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>("5x");
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);
  const [currentPlanId, setCurrentPlanId] = useState<string>(() =>
    readCachedPlanId("free"),
  );
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const refreshCurrentPlan = useCallback(async () => {
    try {
      const overview = await getBillingSubscription();
      const planId = overview.subscription?.plan_id ?? "free";
      const match = overview.plans?.find((p) => p.id === planId);
      const cached = writeCachedBillingPlan(
        planId,
        match?.display_name || planId,
      );
      setCurrentPlanId(cached.planId);
    } catch {
      /* keep cached / previous */
    }
  }, []);

  useEffect(() => {
    void refreshCurrentPlan();
  }, [refreshCurrentPlan, plansRefreshKey]);

  useEffect(() => {
    const onBillingUpdated = () => {
      setPlansRefreshKey((k) => k + 1);
    };
    window.addEventListener("clauxen:billing-updated", onBillingUpdated);
    return () => {
      window.removeEventListener("clauxen:billing-updated", onBillingUpdated);
    };
  }, []);

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
      try {
        window.sessionStorage.setItem("clauxen:checkout-success", "1");
      } catch {
        /* ignore */
      }
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
      <div
        ref={surfaceRef}
        data-app-overlay-surface=""
        tabIndex={-1}
        className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-[var(--app-shell-bg)] outline-none [scrollbar-gutter:stable]"
        data-scroll-region=""
      >
        {currentView === "plans" && (
          <UpgradePageContent
            key={plansRefreshKey}
            onClose={onClose}
            currentPlanId={currentPlanId}
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
