"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { Switch } from "@/frontend/components/ui/switch";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingCard,
  OnboardingHeading,
  OnboardingLink,
  OnboardingPrimaryButton,
} from "../onboarding-ui";

type BeforeChatStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  busy?: boolean;
};

const DISCLAIMERS = [
  {
    iconBg: "bg-zinc-100",
    icon: <Ban className="h-5 w-5 text-zinc-700" aria-hidden />,
    title: "Ad-free chats:",
    body: "We won't show you ads or let advertisers influence what Clauxen says.",
  },
  {
    iconBg: "bg-zinc-100",
    icon: <ShieldCheck className="h-5 w-5 text-zinc-700" aria-hidden />,
    title: "Built to help, not harm:",
    body: "Automated safeguards protect your chats from violent, abusive, or deceptive content.",
  },
] as const;

export function BeforeChatStep({
  state,
  onChange,
  onContinue,
  busy = false,
}: BeforeChatStepProps) {
  return (
    <OnboardingShell contentClassName="!py-8">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <OnboardingHeading
          title="Before your first chat"
          subtitle="A few things to know, plus one setting to review"
        />

        <OnboardingCard className="rounded-3xl p-6">
          <ul className="flex flex-col gap-6" role="list">
            {DISCLAIMERS.map((item) => (
              <li key={item.title} className="flex gap-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.iconBg}`}
                >
                  {item.icon}
                </div>
                <p className="text-sm font-medium leading-relaxed text-zinc-600">
                  <span className="font-semibold text-zinc-900">
                    {item.title}
                  </span>{" "}
                  {item.body}
                </p>
              </li>
            ))}

            <li className="flex gap-4">
              <div className="mt-0.5 shrink-0 pt-1">
                <Switch
                  checked={state.modelImprovementOptIn}
                  onCheckedChange={(modelImprovementOptIn) =>
                    onChange({ modelImprovementOptIn })
                  }
                  disabled={busy}
                  aria-labelledby="disclaimer-grove-toggle-label"
                />
              </div>
              <p
                id="disclaimer-grove-toggle-label"
                className="text-sm font-medium leading-relaxed text-zinc-600"
              >
                <span className="font-semibold text-zinc-900">
                  Help Clauxen improve:
                </span>{" "}
                Allow the use of your chats and coding sessions to train and
                improve Clauxen. Change anytime in privacy settings.{" "}
                <OnboardingLink href="/legal/privacy">Learn more</OnboardingLink>
              </p>
            </li>
          </ul>
        </OnboardingCard>

        <OnboardingPrimaryButton
          type="button"
          disabled={busy}
          onClick={onContinue}
        >
          {busy ? "Saving…" : "Continue"}
        </OnboardingPrimaryButton>
      </div>
    </OnboardingShell>
  );
}
