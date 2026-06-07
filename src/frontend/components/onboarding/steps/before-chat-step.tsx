"use client";

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
};

const DISCLAIMERS = [
  {
    iconBg: "bg-[#cbcadb]",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="text-black"
        aria-hidden
      >
        <path d="M17.225 2.082a.5.5 0 0 1 .693.693l-.064.078-15 15a.5.5 0 1 1-.708-.707l2.986-2.986c-1.063-.864-1.909-1.87-2.476-2.642l-.245-.342a2.09 2.09 0 0 1-.039-2.36C3.41 7.24 6.012 4 10 4c1.555 0 2.881.495 3.973 1.187l.079.052 3.095-3.093z" />
      </svg>
    ),
    title: "Ad-free chats:",
    body: "We won't show you ads or let advertisers influence what Clauxen says.",
  },
  {
    iconBg: "bg-[#bcd1ca]",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="text-black"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M13.5 3c1.165 0 2.058.518 2.648 1.291.578.76.852 1.746.852 2.709 0 .889-.272 1.72-.71 2.501.947.015 1.71.786 1.71 1.736v.096c0 .577-.272 1.12-.733 1.467l-4.4 3.3a4.5 4.5 0 0 1-2.7.9H3.5A1.5 1.5 0 0 1 2 15.5v-3A1.5 1.5 0 0 1 3.5 11h1.281C3.748 9.8 3 8.477 3 7c0-.963.274-1.95.853-2.709C4.442 3.518 5.335 3 6.5 3c1.15 0 2.055.482 2.708 1.064.32.286.584.6.792.902.208-.302.472-.616.792-.902C11.445 3.482 12.35 3 13.5 3m-10 9a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5H5v-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: "Built to help, not harm:",
    body: "Automated safeguards protect your chats from violent, abusive, or deceptive content.",
  },
] as const;

export function BeforeChatStep({
  state,
  onChange,
  onContinue,
}: BeforeChatStepProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-zinc-50 text-zinc-900">
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
                  <p className="text-sm font-medium leading-relaxed text-zinc-700">
                    <span className="font-semibold text-zinc-900">
                      {item.title}
                    </span>{" "}
                    {item.body}
                  </p>
                </li>
              ))}

              <li className="flex gap-4 border-t border-transparent pt-0">
                <div className="mt-0.5 shrink-0 pt-1">
                  <Switch
                    checked={state.modelImprovementOptIn}
                    onCheckedChange={(modelImprovementOptIn) =>
                      onChange({ modelImprovementOptIn })
                    }
                    aria-labelledby="disclaimer-grove-toggle-label"
                  />
                </div>
                <p
                  id="disclaimer-grove-toggle-label"
                  className="text-sm font-medium leading-relaxed text-zinc-700"
                >
                  <span className="font-semibold text-zinc-900">
                    Help Clauxen improve:
                  </span>{" "}
                  Allow the use of your chats and coding sessions to train and
                  improve Clauxen. Change anytime in privacy settings.{" "}
                  <OnboardingLink href="https://privacy.claude.com/en/articles/12109829-how-do-i-change-my-model-improvement-privacy-settings">
                    Learn more
                  </OnboardingLink>
                </p>
              </li>
            </ul>
          </OnboardingCard>

          <OnboardingPrimaryButton type="button" onClick={onContinue}>
            Continue
          </OnboardingPrimaryButton>
        </div>
      </OnboardingShell>
    </div>
  );
}
