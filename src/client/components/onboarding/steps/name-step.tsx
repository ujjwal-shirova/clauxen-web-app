"use client";

import { ONBOARDING_ROLES } from "@/lib/work-roles";
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
  busy?: boolean;
};

export function NameStep({
  state,
  onChange,
  onContinue,
  busy = false,
}: NameStepProps) {
  const trimmed = state.displayName.trim();
  const canContinue = trimmed.length > 0 && !busy;

  return (
    <OnboardingShell>
      <div className="flex w-full max-w-xl flex-col gap-8">
        <OnboardingHeading
          title="What should we call you?"
          subtitle="A preferred name is all we need. You can change it in your profile anytime."
        />

        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue) onContinue();
          }}
        >
          <label
            htmlFor="onboarding-name"
            className="mb-3 block text-sm font-medium"
          >
            Your name
          </label>
          <OnboardingTextInput
            id="onboarding-name"
            maxLength={120}
            disabled={busy}
            value={state.displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder="Enter your name"
            autoComplete="name"
            aria-label="What should we call you?"
            autoFocus
          />
          <label
            htmlFor="onboarding-role"
            className="mb-3 mt-6 block text-sm font-medium"
          >
            What kind of work do you do?{" "}
            <span className="font-normal text-zinc-500">Optional</span>
          </label>
          <select
            id="onboarding-role"
            value={state.role}
            onChange={(e) => onChange({ role: e.target.value })}
            disabled={busy}
            className="min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="">Prefer not to say</option>
            {state.role &&
            !ONBOARDING_ROLES.some((role) => role === state.role) ? (
              <option value={state.role}>{state.role}</option>
            ) : null}
            {ONBOARDING_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Your name and role help personalize your conversations.
          </p>
          <OnboardingPrimaryButton
            type="submit"
            disabled={!canContinue}
            className="mt-6"
          >
            {busy ? "Saving…" : "Continue"}
          </OnboardingPrimaryButton>
        </form>
      </div>
    </OnboardingShell>
  );
}
