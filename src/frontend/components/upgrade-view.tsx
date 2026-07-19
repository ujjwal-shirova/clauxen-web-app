"use client";

import React, { useCallback, useState } from "react";
import UpgradePageContent from "./subscription";
import type { MaxTier } from "./billing-checkout";
import { BillingCheckout } from "./billing-checkout";
import { CheckoutPreparing } from "./checkout-preparing";
import { InvoiceView, type InvoiceData } from "./invoice-view";
import { FullscreenPortal } from "./fullscreen-portal";
import {
  billingInvoicePdfUrl,
  createCheckoutSession,
  getBillingInvoice,
} from "@/frontend/lib/api/billing";

interface UpgradeViewProps {
  onClose: () => void;
}

type BillingCycle = "monthly" | "yearly";
type ViewState = "plans" | "preparing" | "checkout" | "invoice";

export function UpgradeView({ onClose }: UpgradeViewProps) {
  const [currentView, setCurrentView] = useState<ViewState>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>("monthly");
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>("5x");
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);

  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(
    null,
  );

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const resetToPlans = () => {
    setCurrentView("plans");
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setCheckoutSessionId(null);
    setInvoiceData(null);
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
      setCheckoutSessionId(null);
      setCurrentView("preparing");
    },
    [],
  );

  const createSessionForSelected = useCallback(
    async (attempt = 1) => {
      if (!selectedPlanId) return;

      try {
        const session = await createCheckoutSession({
          planId: selectedPlanId,
          planName: selectedPlanName || "Selected Plan",
          billingCycle: selectedBillingCycle,
          maxTier: selectedMaxTier,
          returnPath:
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/checkout/")
              ? window.location.pathname
              : "/new",
        });

        setCheckoutSessionId(session.sessionId);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", session.checkoutPath);
        }
        setCurrentView("checkout");
      } catch {
        if (attempt < 4) {
          window.setTimeout(() => {
            void createSessionForSelected(attempt + 1);
          }, 700 * attempt);
        } else {
          setCurrentView("checkout");
        }
      }
    },
    [
      selectedPlanId,
      selectedPlanName,
      selectedBillingCycle,
      selectedMaxTier,
    ],
  );

  React.useEffect(() => {
    if (currentView === "preparing" && selectedPlanId && !checkoutSessionId) {
      void createSessionForSelected(1);
    }
  }, [
    currentView,
    selectedPlanId,
    checkoutSessionId,
    createSessionForSelected,
  ]);

  const handleBackToPlans = () => {
    resetToPlans();
  };

  const handlePaymentSuccess = async (details?: {
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }) => {
    const paymentId = details?.razorpayPaymentId;
    if (paymentId) {
      // Poll briefly while Cloudflare generates the PDF + DB settles.
      for (let i = 0; i < 6; i++) {
        try {
          const res = await getBillingInvoice(paymentId);
          setInvoiceData({
            ...res.invoice,
            paymentId,
            pdfAvailable: Boolean(res.pdfKey),
          });
          setCurrentView("invoice");
          setPlansRefreshKey((k) => k + 1);
          return;
        } catch {
          await new Promise((r) => window.setTimeout(r, 400 * (i + 1)));
        }
      }
    }

    // Fallback snapshot if server invoice is not ready yet.
    const now = new Date();
    setInvoiceData({
      invoiceNumber: (
        details?.razorpayOrderId ||
        checkoutSessionId ||
        `INV${Date.now()}`
      )
        .slice(-14)
        .toUpperCase(),
      issuedAt: now.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      status: "paid",
      currency: "INR",
      billedTo: { name: "You" },
      items: [
        {
          label: selectedPlanName || "Shirova Subscription",
          sublabel: `${selectedBillingCycle} · auto-renew`,
          quantity: "1",
          amount: 0,
        },
      ],
      subtotal: 0,
      total: 0,
      paymentMethod: "Razorpay",
      razorpayPaymentId: paymentId,
      paymentId,
    });
    setCurrentView("invoice");
    setPlansRefreshKey((k) => k + 1);
  };

  const handleInvoiceClose = () => {
    resetToPlans();
  };

  const handleInvoiceDownload = () => {
    const paymentId =
      invoiceData?.paymentId || invoiceData?.razorpayPaymentId;
    if (paymentId) {
      window.open(billingInvoicePdfUrl(paymentId), "_blank", "noopener");
      return;
    }
    window.print();
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[200] overflow-hidden bg-white">
        {currentView === "plans" && (
          <UpgradePageContent
            key={plansRefreshKey}
            onClose={onClose}
            onSelectPlan={(planId, cycle, tier, name) =>
              handleSelectPlan(planId, cycle, tier, name)
            }
          />
        )}

        {currentView === "preparing" && selectedPlanId && (
          <CheckoutPreparing
            planId={selectedPlanId}
            maxTier={selectedMaxTier}
          />
        )}

        {currentView === "checkout" && selectedPlanId && (
          <BillingCheckout
            onBack={handleBackToPlans}
            onPaymentSuccess={handlePaymentSuccess}
            planId={selectedPlanId}
            initialBillingCycle={selectedBillingCycle}
            initialMaxTier={selectedMaxTier}
            initialCheckoutSessionId={checkoutSessionId}
          />
        )}

        {currentView === "invoice" && invoiceData && (
          <InvoiceView
            data={invoiceData}
            onClose={handleInvoiceClose}
            onDownload={handleInvoiceDownload}
          />
        )}
      </div>
    </FullscreenPortal>
  );
}
