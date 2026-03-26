'use client';

import React, { useState } from 'react';
import UpgradePageContent from './subscription';
import { BillingCheckout } from './billing-checkout';

interface UpgradeViewProps {
  onClose: () => void;
}

type BillingCycle = 'monthly' | 'yearly';

/**
 * UpgradeView handles the modal presentation of the subscription plans.
 * It manages the flow between plan selection and the billing checkout.
 */
export function UpgradeView({ onClose }: UpgradeViewProps) {
  const [currentView, setCurrentView] = useState<'plans' | 'checkout'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('monthly');

  const handleSelectPlan = (planId: string, billingCycle: BillingCycle) => {
    setSelectedPlanId(planId);
    setSelectedBillingCycle(billingCycle);
    setCurrentView('checkout');
  };

  const handleBackToPlans = () => {
    setCurrentView('plans');
    setSelectedPlanId(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#FAF9F5] animate-in fade-in duration-300 overflow-hidden">
      {currentView === 'plans' ? (
        <UpgradePageContent 
          onClose={onClose} 
          onSelectPlan={handleSelectPlan}
        />
      ) : (
        <BillingCheckout 
          onBack={handleBackToPlans}
          planId={selectedPlanId}
          initialBillingCycle={selectedBillingCycle}
        />
      )}
    </div>
  );
}
