"use client";

import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingGhostButton,
} from "../onboarding-ui";
import type { OnboardingState } from "../onboarding-types";

export function DesktopStep({
  state,
  onChange,
  onContinue,
  onSkip,
  busy = false,
}: {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  return (
    <OnboardingShell>
      <div className="flex w-full max-w-xl flex-col gap-8">
        <OnboardingHeading
          title="How do you like to work?"
          subtitle="Set a starting point for your replies. You can adjust these in Personalization settings anytime."
        />
        <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-3 text-sm font-medium">Response length</legend>
          {(
            [
              [
                "balanced",
                "A little of both",
                "Clear answers with detail when it helps.",
              ],
              ["concise", "Keep it short", "Direct answers, fewer words."],
              [
                "detailed",
                "Go into detail",
                "More context and thorough explanations.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${state.responsePreference === value ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}
            >
              <input
                type="radio"
                name="response-preference"
                value={value}
                checked={state.responsePreference === value}
                onChange={() => onChange({ responsePreference: value })}
                className="h-4 w-4 accent-zinc-950"
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-sm text-zinc-500">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <label
            htmlFor="onboarding-instructions"
            className="text-sm font-medium"
          >
            Anything else Clauxen should know?{" "}
            <span className="font-normal text-zinc-400">Optional</span>
          </label>
          <textarea
            id="onboarding-instructions"
            disabled={busy}
            value={state.customInstructions}
            onChange={(e) => onChange({ customInstructions: e.target.value })}
            maxLength={1500}
            rows={3}
            placeholder="For example: use plain language and include practical examples."
            className="mt-3 w-full resize-y rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-950 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Avoid passwords or other sensitive information.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <OnboardingPrimaryButton disabled={busy} onClick={onContinue}>
            Save preferences
          </OnboardingPrimaryButton>
          <OnboardingGhostButton disabled={busy} onClick={onSkip}>
            Use default preferences
          </OnboardingGhostButton>
        </div>
      </div>
    </OnboardingShell>
  );
}
