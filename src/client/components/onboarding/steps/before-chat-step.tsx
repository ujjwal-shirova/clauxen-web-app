"use client";

import { ShieldCheck } from "lucide-react";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingHeading,
  OnboardingLink,
  OnboardingPrimaryButton,
} from "../onboarding-ui";

export function BeforeChatStep({
  state,
  onChange,
  onContinue,
  busy = false,
}: {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  return (
    <OnboardingShell>
      <div className="flex w-full max-w-xl flex-col gap-8">
        <OnboardingHeading
          title="Your data. Your choice."
          subtitle="Decide whether your conversations can help train and improve Clauxen. This is optional and separate from using the service."
        />
        <fieldset
          disabled={busy}
          aria-describedby="training-disclosure"
          className="space-y-3"
        >
          <legend className="mb-3 text-sm font-medium">
            Allow your data to be used for model training?
          </legend>
          {(
            [
              [
                false,
                "Don’t allow training",
                "Do not use my chats and coding sessions to train or improve Clauxen.",
              ],
              [
                true,
                "Allow training",
                "My chats and coding sessions may be used to train and improve Clauxen.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <label
              key={String(value)}
              className={`flex cursor-pointer items-start gap-4 rounded-xl border p-5 transition-colors ${state.modelImprovementOptIn === value ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"}`}
            >
              <input
                type="radio"
                name="training-consent"
                checked={state.modelImprovementOptIn === value}
                onChange={() => onChange({ modelImprovementOptIn: value })}
                className="mt-1 h-4 w-4 shrink-0 accent-zinc-950"
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-zinc-500">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div
          id="training-disclosure"
          className="flex gap-3 text-sm leading-relaxed text-zinc-500"
        >
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-zinc-700"
            aria-hidden
          />
          <p>
            Either choice lets you use Clauxen. Your data is still processed to
            provide the service as described in our{" "}
            <OnboardingLink href="/legal/privacy">
              Privacy Policy
            </OnboardingLink>
            . Change your choice in Settings → Data controls.
          </p>
        </div>
        <p className="border-t border-zinc-100 pt-5 text-xs leading-relaxed text-zinc-500">
          Clauxen can make mistakes. Check important information and review
          generated work before using it.
        </p>
        <OnboardingPrimaryButton
          disabled={busy || state.modelImprovementOptIn === null}
          onClick={onContinue}
        >
          Save my choice
        </OnboardingPrimaryButton>
      </div>
    </OnboardingShell>
  );
}
