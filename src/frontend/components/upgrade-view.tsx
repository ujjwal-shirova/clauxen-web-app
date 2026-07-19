"use client";

import React, { useCallback, useState } from "react";
import UpgradePageContent from "./subscription";
import type { MaxTier } from "./billing-checkout";
import { BillingCheckout } from "./billing-checkout";
import { CheckoutPreparing } from "./checkout-preparing";
import { InvoiceView, type InvoiceData } from "./invoice-view";
import { FullscreenPortal } from "./fullscreen-portal";
import { createCheckoutSession } from "@/frontend/lib/api/billing";

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

  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const resetToPlans = () => {
    setCurrentView("plans");
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setCheckoutSessionId(null);
    setInvoiceData(null);
  };

  // Called from plans when user clicks "Upgrade to X"
  const handleSelectPlan = useCallback(
    (planId: string, billingCycle: BillingCycle, maxTier?: MaxTier, planDisplayName?: string) => {
      setSelectedPlanId(planId);
      setSelectedBillingCycle(billingCycle);
      if (maxTier) setSelectedMaxTier(maxTier);
      setSelectedPlanName(planDisplayName || planId);
      setCheckoutSessionId(null);
      setCurrentView("preparing");
    },
    [],
  );

  // Actually create the session (robust, with light retry). This runs while showing shimmer.
  const createSessionForSelected = useCallback(async (attempt = 1) => {
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
        // Stay on preparing visuals; checkout can create a session as fallback.
        setCurrentView("checkout");
      }
    }
  }, [selectedPlanId, selectedPlanName, selectedBillingCycle, selectedMaxTier]);

  // When we enter "preparing", kick off the session creation.
  React.useEffect(() => {
    if (currentView === "preparing" && selectedPlanId && !checkoutSessionId) {
      void createSessionForSelected(1);
    }
  }, [currentView, selectedPlanId, checkoutSessionId, createSessionForSelected]);

  const handleBackToPlans = () => {
    resetToPlans();
  };

  // After successful payment we build a nice invoice snapshot.
  // In production you would re-fetch the finalized billing_order + payment row
  // from your server (using the razorpay ids) to get 100% accurate line items/totals.
  const handlePaymentSuccess = (details?: { razorpayPaymentId?: string; razorpayOrderId?: string }) => {
    const now = new Date();
    const invoice: InvoiceData = {
      invoiceNumber: (details?.razorpayOrderId || checkoutSessionId || `INV${Date.now()}`).slice(-14).toUpperCase(),
      issuedAt: now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      status: "paid",
      currency: "INR",
      billedTo: {
        name: "You",
        email: undefined,
      },
      items: [
        {
          label: selectedPlanName || "shirova Subscription",
          sublabel: `${selectedBillingCycle} • ${selectedMaxTier === "20x" ? "Max 20x" : selectedMaxTier === "5x" ? "Max 5x" : "Plan"}`,
          quantity: "1",
          amount: 0, // Replace with real computed subtotal+tax from order when available
        },
      ],
      subtotal: 0,
      total: 0,
      paymentMethod: "Razorpay (Card / UPI / Netbanking)",
      razorpayPaymentId: details?.razorpayPaymentId,
    };

    setInvoiceData(invoice);
    setCurrentView("invoice");

    setPlansRefreshKey((k) => k + 1);
  };

  const handleInvoiceClose = () => {
    // After seeing invoice, return to refreshed plans or close the modal
    resetToPlans();
    // Optionally close the whole upgrade overlay:
    // onClose();
  };

  const handleInvoiceDownload = () => {
    // Best practical robust solution today: trigger browser print-to-PDF
    // which produces a pixel-perfect version of our beautiful invoice.
    // For server PDF see the comments inside InvoiceView.tsx (pdfkit recommended).
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
