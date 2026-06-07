'use client';

import React, { useState } from 'react';
import UpgradePageContent from './subscription';
import type { MaxTier } from './billing-checkout';
import { BillingCheckout } from './billing-checkout';

interface UpgradeViewProps {
  onClose: () => void;
}

type BillingCycle = 'monthly' | 'yearly';

export function UpgradeView({ onClose }: UpgradeViewProps) {
  const [currentView, setCurrentView] = useState<'plans' | 'checkout'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>('5x');
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);

  const handleSelectPlan = (planId: string, billingCycle: BillingCycle, maxTier?: MaxTier) => {
    setSelectedPlanId(planId);
    setSelectedBillingCycle(billingCycle);
    if (maxTier) {
      setSelectedMaxTier(maxTier);
    }
    setCurrentView('checkout');
  };

  const handleBackToPlans = () => {
    setCurrentView('plans');
    setSelectedPlanId(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-50 animate-in fade-in duration-300 overflow-hidden"> 
      {currentView === 'plans' ? (
        <UpgradePageContent
          key={plansRefreshKey}
          onClose={onClose}
          onSelectPlan={handleSelectPlan}
        />
      ) : selectedPlanId ? (
        <BillingCheckout
          onBack={handleBackToPlans}
          onPaymentSuccess={() => {
            setPlansRefreshKey((k) => k + 1); // remount trigger — plans API/state refresh
            setCurrentView('plans');
            setSelectedPlanId(null);
          }}
          planId={selectedPlanId}
          initialBillingCycle={selectedBillingCycle}
          initialMaxTier={selectedMaxTier}
        />
      ) : null}
    </div>
  );
}
