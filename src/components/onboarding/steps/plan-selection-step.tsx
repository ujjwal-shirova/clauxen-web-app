"use client";

import { useCallback, useState } from "react";
import { PlansCarouselSection } from "@/components/subscription";
import type { MaxTier } from "@/components/billing-checkout";
import { BillingCheckout } from "@/components/billing-checkout";
import { CHECKOUT_PLAN_IDS } from "@/lib/plans-catalog";
import type { OnboardingAnswers } from "@/lib/api/onboarding";
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
type ViewState = "plans" | "checkout";

export function PlanSelectionStep({
  state,
  onChange,
  onContinue,
  onSelectFree,
  busy = false,
}: PlanSelectionStepProps) {
  const [view, setView] = useState<ViewState>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>("monthly");
  const [selectedMaxTier, setSelectedMaxTier] = useState<MaxTier>("5x");

  const startCheckout = useCallback(
    (
      planId: string,
      billingCycle: BillingCycle,
      maxTier?: MaxTier,
      _planDisplayName?: string,
    ) => {
      onChange({
        selectedPlanId: planId as OnboardingPlanId,
        selectedBillingCycle: billingCycle,
      });
      setSelectedPlanId(planId);
      setSelectedBillingCycle(billingCycle);
      if (maxTier) setSelectedMaxTier(maxTier);
      setView("checkout");
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

  const backToPlans = () => {
    setView("plans");
    setSelectedPlanId(null);
  };

  if (view === "checkout" && selectedPlanId) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[var(--app-shell-bg)]">
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
          returnPath="/onboarding"
        />
      </div>
    );
  }

  return (
    <OnboardingShell contentClassName="!items-stretch !justify-start !py-4 md:!py-6">
      <div className="mx-auto flex w-full min-h-0 max-w-[1100px] flex-col items-center gap-6 pb-10">
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
