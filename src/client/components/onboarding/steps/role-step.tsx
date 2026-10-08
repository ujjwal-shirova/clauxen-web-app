"use client";

import { Check } from "lucide-react";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import { OnboardingHeading, OnboardingPrimaryButton } from "../onboarding-ui";
import { getCheckoutPlanDetails } from "@/lib/plans-catalog";

export function RoleStep({
  state,
  onContinue,
  busy = false,
}: {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: (role?: string) => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const ready =
    state.termsAccepted &&
    state.privacyAccepted &&
    state.displayName.trim().length > 0 &&
    typeof state.modelImprovementOptIn === "boolean";
  const summary = [
    ["Preferred name", state.displayName.trim() || "Not set"],
    ["Your work", state.role || "Not specified"],
    [
      "Response length",
      state.responsePreference === "concise"
        ? "Short and direct"
        : state.responsePreference === "detailed"
          ? "Detailed"
          : "Balanced",
    ],
    ["Custom instructions", state.customInstructions.trim() || "None"],
    [
      "Model training",
      state.modelImprovementOptIn === true
        ? "Allowed"
        : state.modelImprovementOptIn === false
          ? "Not allowed"
          : "Choice required",
    ],
    ["Product emails", state.marketingOptIn ? "Subscribed" : "Off"],
    ["Your plan", getCheckoutPlanDetails(state.selectedPlanId).name],
  ];
  return (
    <OnboardingShell>
      <div className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200">
          <Check className="h-5 w-5" aria-hidden />
        </div>
        <OnboardingHeading
          title={`Make yourself at home${state.displayName.trim() ? `, ${state.displayName.trim()}` : ""}.`}
          subtitle="Here’s how your space is set up. Review your choices, then start your first conversation."
        />
        <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 px-5">
          {summary.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-4 text-sm"
            >
              <dt className="text-zinc-500">{label}</dt>
              <dd className="break-words text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {!ready ? (
          <p role="alert" className="text-sm text-rose-700">
            Use Back to complete your name, agreements, and training choice
            before continuing.
          </p>
        ) : null}
        <OnboardingPrimaryButton
          disabled={busy || !ready}
          onClick={() => onContinue(state.role)}
        >
          {busy ? "Finishing setup…" : "Open Clauxen"}
        </OnboardingPrimaryButton>
        <p className="text-xs leading-relaxed text-zinc-500">
          You can update your preferences in Settings. Clauxen can make
          mistakes, so check important information and review generated work.
        </p>
      </div>
    </OnboardingShell>
  );
}
