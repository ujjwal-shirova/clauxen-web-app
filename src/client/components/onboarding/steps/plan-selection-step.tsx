"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { BillingCheckout } from "@/components/billing-checkout";
import {
  PERSONAL_PLANS,
  formatInr,
  MAX_TIER_OPTIONS,
} from "@/lib/plans-catalog";
import type { OnboardingAnswers } from "@/lib/api/onboarding";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import { OnboardingHeading, OnboardingPrimaryButton } from "../onboarding-ui";

export function PlanSelectionStep({
  onContinue,
  onSelectFree,
  busy = false,
}: {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: (answers?: OnboardingAnswers) => void;
  onSelectFree: () => void;
  busy?: boolean;
}) {
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  if (checkoutPlan) {
    return (
      <div
        className="fixed inset-0 z-[100] overflow-auto bg-white"
        style={{ colorScheme: "light" }}
      >
        <BillingCheckout
          planId={checkoutPlan}
          initialBillingCycle="monthly"
          initialMaxTier="5x"
          returnPath="/onboarding#plan-selection"
          onBack={() => setCheckoutPlan(null)}
          onPaymentSuccess={() =>
            onContinue({
              selectedPlanId: checkoutPlan === "max" ? "max5x" : checkoutPlan,
              selectedBillingCycle: "monthly",
            })
          }
        />
      </div>
    );
  }

  return (
    <OnboardingShell>
      <div className="flex w-full flex-col gap-8">
        <OnboardingHeading
          title="Start with what you need."
          subtitle="Free is a good place to begin. Choose a paid plan for more access, or upgrade later from Settings."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {PERSONAL_PLANS.map((plan) => {
            const features =
              typeof plan.features === "function"
                ? plan.features({ maxTier: "5x" })
                : plan.features;
            const price =
              plan.monthlyPriceInr ?? MAX_TIER_OPTIONS["5x"].monthlyPriceInr;
            return (
              <section
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2
                    id={`plan-${plan.id}`}
                    className="text-base font-semibold"
                  >
                    {plan.name}
                    {plan.id === "max" ? " 5x" : ""}
                  </h2>
                  {plan.id === "free" ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      Start here
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {formatInr(price)}
                  <span className="text-xs font-normal tracking-normal text-zinc-500">
                    {" "}
                    / month
                  </span>
                </p>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-zinc-500">
                  {plan.description}
                </p>
                <ul className="my-5 flex-1 space-y-2.5">
                  {features.slice(0, 3).map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-xs leading-relaxed text-zinc-600"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <OnboardingPrimaryButton
                  disabled={busy}
                  onClick={() =>
                    plan.id === "free"
                      ? onSelectFree()
                      : setCheckoutPlan(plan.id)
                  }
                  className={
                    plan.id === "free"
                      ? ""
                      : "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                  }
                >
                  {plan.id === "free"
                    ? "Continue with Free"
                    : `Choose ${plan.name}`}
                </OnboardingPrimaryButton>
              </section>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">
          No payment details needed for Free. Paid plans renew monthly;
          applicable taxes and the total are shown at checkout. Usage limits
          apply. Explore annual billing and team plans in Settings.
        </p>
      </div>
    </OnboardingShell>
  );
}
