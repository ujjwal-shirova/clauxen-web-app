"use client";

import { useCallback, useEffect, useState } from "react";
import { PlansCarouselSection } from "@/frontend/components/subscription";
import type { MaxTier } from "@/frontend/components/billing-checkout";
import { BillingCheckout } from "@/frontend/components/billing-checkout";
import { CheckoutPreparing } from "@/frontend/components/checkout-preparing";
import { createCheckoutSession } from "@/frontend/lib/api/billing";
import { CHECKOUT_PLAN_IDS } from "@/lib/plans-catalog";
import type { OnboardingAnswers } from "@/frontend/lib/api/onboarding";
import type { OnboardingPlanId, OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingGhostButton,
  OnboardingHeading,
} from "../onboarding-ui";

type PlanSelectionStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: (answers?: OnboardingAnswers) => void;
  onSelectFree: () => void;
  busy?: boolean;
};

type BillingCycle = "monthly" | "yearly";
type ViewState = "plans" | "preparing" | "checkout";

export function PlanSelectionStep({
  state,
  onChange,
  onContinue,
  onSelectFree,
  busy = false,
}: PlanSelectionStepProps) {
  const [view, setView] = useState<ViewState>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>("monthly");
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>("5x");
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(
    null,
  );

  const startCheckout = useCallback(
    (
      planId: string,
      billingCycle: BillingCycle,
      maxTier?: MaxTier,
      planDisplayName?: string,
    ) => {
      onChange({
        selectedPlanId: planId as OnboardingPlanId,
        selectedBillingCycle: billingCycle,
      });
      setSelectedPlanId(planId);
      setSelectedBillingCycle(billingCycle);
      if (maxTier) setSelectedMaxTier(maxTier);
      setSelectedPlanName(planDisplayName || planId);
      setCheckoutSessionId(null);
      setView("preparing");
    },
    [onChange],
  );

  const handlePersonalSelect = (
    plan: { id: string; name: string },
    cycle: BillingCycle,
    tier?: MaxTier,
    displayName?: string,
  ) => {
    if (plan.id === "free" || !CHECKOUT_PLAN_IDS.has(plan.id)) {
      onChange({
        selectedPlanId: "free",
        selectedBillingCycle: "monthly",
      });
      onSelectFree();
      return;
    }
    startCheckout(plan.id, cycle, tier, displayName ?? plan.name);
  };

  const handleOrganizationSelect = (
    plan: { id: string; name: string },
    cycle: BillingCycle,
    displayName?: string,
  ) => {
    onChange({
      selectedPlanId: plan.id,
      selectedBillingCycle: cycle,
    });
    if (!CHECKOUT_PLAN_IDS.has(plan.id)) {
      onContinue({
        selectedPlanId: plan.id,
        selectedBillingCycle: cycle,
      });
      return;
    }
    startCheckout(plan.id, cycle, undefined, displayName ?? plan.name);
  };

  const createSessionForSelected = useCallback(
    async (attempt = 1) => {
      if (!selectedPlanId) return;
      try {
        const session = await createCheckoutSession({
          planId: selectedPlanId,
          planName: selectedPlanName || "Selected Plan",
          billingCycle: selectedBillingCycle,
          maxTier: selectedMaxTier,
        });
        setCheckoutSessionId(session.sessionId);
        setView("checkout");
      } catch {
        if (attempt < 4) {
          window.setTimeout(() => {
            void createSessionForSelected(attempt + 1);
          }, 700 * attempt);
        } else {
          setView("checkout");
        }
      }
    },
    [selectedPlanId, selectedPlanName, selectedBillingCycle, selectedMaxTier],
  );

  useEffect(() => {
    if (view === "preparing" && selectedPlanId && !checkoutSessionId) {
      void createSessionForSelected(1);
    }
  }, [view, selectedPlanId, checkoutSessionId, createSessionForSelected]);

  const backToPlans = () => {
    setView("plans");
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setCheckoutSessionId(null);
  };

  if (view === "preparing" && selectedPlanId) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-white">
        <CheckoutPreparing planId={selectedPlanId} maxTier={selectedMaxTier} />
      </div>
    );
  }

  if (view === "checkout" && selectedPlanId) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-white">
        <BillingCheckout
          onBack={backToPlans}
          onPaymentSuccess={() => {
            onChange({
              selectedPlanId: selectedPlanId as OnboardingPlanId,
              selectedBillingCycle,
            });
            onContinue({
              selectedPlanId,
              selectedBillingCycle,
            });
          }}
          planId={selectedPlanId}
          initialBillingCycle={selectedBillingCycle}
          initialMaxTier={selectedMaxTier}
          initialCheckoutSessionId={checkoutSessionId}
        />
      </div>
    );
  }

  return (
    <OnboardingShell contentClassName="!justify-start !py-6 md:!py-8">
      <div className="flex w-full max-w-[1100px] flex-col items-center gap-6">
        <OnboardingHeading
          title="Plans that grow with you"
          subtitle="Start free, or pick a plan that fits how you work"
        />

        <PlansCarouselSection
          layout="tabs"
          selectableCurrentPlanIds={["free"]}
          onPersonalPlanSelect={handlePersonalSelect}
          onOrganizationPlanSelect={handleOrganizationSelect}
          className="w-full"
        />

        <p className="max-w-xl text-center text-sm text-zinc-500">
          Usage limits apply. Prices and plans are subject to change.
        </p>

        <OnboardingGhostButton
          type="button"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            const selectedPlanId = (state.selectedPlanId ||
              "free") as OnboardingPlanId;
            onChange({ selectedPlanId });
            onContinue({
              selectedPlanId: String(selectedPlanId),
              selectedBillingCycle: state.selectedBillingCycle,
            });
          }}
          className="max-w-[280px]"
        >
          {busy ? "Saving…" : "Skip for now"}
        </OnboardingGhostButton>
      </div>
    </OnboardingShell>
  );
}
