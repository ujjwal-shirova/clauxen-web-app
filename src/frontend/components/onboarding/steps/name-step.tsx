"use client";

import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingTextInput,
} from "../onboarding-ui";

type NameStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
};

export function NameStep({ state, onChange, onContinue }: NameStepProps) {
  const trimmed = state.displayName.trim();
  const canContinue = trimmed.length > 0;

  return (
    <OnboardingShell>
      <div className="flex w-full max-w-[450px] flex-col items-center gap-5">
        <OnboardingHeading
          title="What's your name?"
          subtitle="So Clauxen knows what to call you."
        />

        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue) onContinue();
          }}
        >
          <OnboardingTextInput
            value={state.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder="Enter your name"
            autoComplete="name"
            aria-label="What's your name?"
            autoFocus
          />
          <OnboardingPrimaryButton
            type="submit"
            disabled={!canContinue}
            className="mt-3"
          >
            Continue
          </OnboardingPrimaryButton>
        </form>
      </div>
    </OnboardingShell>
  );
}
