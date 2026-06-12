"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { getBillingPlans, type BillingPlan } from "@/frontend/lib/api/billing";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingGhostButton,
  OnboardingHeading,
  OnboardingPrimaryButton,
} from "../onboarding-ui";
import { ClauxenWordmark } from "../clauxen-wordmark";
import {
  BILLING_CYCLE_PLAN_IDS,
  YEARLY_DISCOUNT_PERCENT,
  formatInrFromPaise,
  getOnboardingPlanCards,
  type OnboardingPlanId,
} from "@/lib/plans-catalog";

type PlanSelectionStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  onSelectFree: () => void;
};

export function PlanSelectionStep({
  state,
  onChange,
  onContinue,
  onSelectFree,
}: PlanSelectionStepProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [apiPlans, setApiPlans] = useState<BillingPlan[]>([]);

  useEffect(() => {
    void getBillingPlans()
      .then((res) => setApiPlans(res.plans ?? []))
      .catch(() => setApiPlans([]));
  }, []);

  const plans = getOnboardingPlanCards().map((plan) => {
    const api = apiPlans.find((p) => p.id === plan.id);
    if (!api) return plan;
    const paise =
      billingCycle === "monthly"
        ? api.price_paise_monthly
        : api.price_paise_yearly;
    return {
      ...plan,
      priceDisplay: formatInrFromPaise(paise),
      priceSuffix:
        billingCycle === "monthly" ? "/ month" : "/ year · billed annually",
    };
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-50 text-zinc-900">
      <header className="flex justify-center px-4 pb-5 pt-8 md:pt-10">
        <ClauxenWordmark />
      </header>

      <main className="mx-auto flex w-full max-w-[1152px] flex-1 flex-col items-center px-2 pb-8">
        <OnboardingHeading title="Plans that grow with you" />

        <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-5 px-1 md:flex-row md:px-1">
          {plans.map((plan) => {
            const selected = state.selectedPlanId === plan.id;
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex max-w-[384px] flex-1 cursor-pointer flex-col rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md",
                  selected && "ring-2 ring-zinc-900/10",
                )}
                onClick={() =>
                  onChange({ selectedPlanId: plan.id as OnboardingPlanId })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange({ selectedPlanId: plan.id as OnboardingPlanId });
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-[#d97757]"
                      aria-hidden
                    >
                      {plan.name.charAt(0)}
                    </div>
                    {BILLING_CYCLE_PLAN_IDS.has(plan.id) && (
                      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBillingCycle("monthly");
                          }}
                          className={cn(
                            "rounded-full px-2.5 py-1 transition-colors",
                            billingCycle === "monthly" &&
                              "bg-zinc-50 shadow-sm",
                          )}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBillingCycle("yearly");
                          }}
                          className={cn(
                            "rounded-full px-2.5 py-1 transition-colors",
                            billingCycle === "yearly" && "bg-zinc-50 shadow-sm",
                          )}
                        >
                          Yearly{" "}
                          <span className="text-[#2977d6]">
                            · Save {YEARLY_DISCOUNT_PERCENT}%
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="min-h-[120px]">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <p className="mt-0.5 text-sm text-zinc-700">
                      {plan.subtitle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-1">
                      <span className="text-3xl font-semibold">
                        {plan.priceDisplay}
                      </span>
                      {plan.priceSuffix ? (
                        <span className="text-xs text-zinc-700">
                          {plan.priceSuffix}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <OnboardingPrimaryButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (plan.id === "free") {
                        onSelectFree();
                      } else {
                        onChange({
                          selectedPlanId: plan.id as OnboardingPlanId,
                        });
                        onContinue();
                      }
                    }}
                  >
                    {plan.cta}
                  </OnboardingPrimaryButton>
                </div>

                <div className="-mx-6 border-t border-zinc-200 px-6 pt-6">
                  {plan.highlight ? (
                    <p className="mb-2 text-sm font-medium text-zinc-700">
                      {plan.highlight}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-1 text-sm text-zinc-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
                          strokeWidth={2.5}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-7 max-w-xl text-center text-sm text-zinc-500">
          <span className="text-zinc-500">*</span>{" "}
          <a
            href="/legal/usage-limits"
            className="underline decoration-zinc-400/40 underline-offset-[3px]"
          >
            Usage limits apply.
          </a>{" "}
          Prices and plans are subject to change.
        </p>
      </main>

      <footer className="px-4 pb-8">
        <OnboardingGhostButton type="button" onClick={onContinue}>
          Skip for now
        </OnboardingGhostButton>
      </footer>
    </div>
  );
}
