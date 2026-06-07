"use client";

import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingGhostButton,
  OnboardingHeading,
  OnboardingPrimaryButton,
} from "../onboarding-ui";
type DesktopStepProps = {
  onContinue: () => void;
  onSkip: () => void;
};

function FeatureColumn({
  tag,
  title,
  description,
  setup,
  illustration,
}: {
  tag: string;
  title: string;
  description: string;
  setup: string;
  illustration: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-1 flex-col border-zinc-200 first:border-r md:flex-row">
      <div className="flex flex-col px-6 pt-6">
        <span className="inline-flex w-fit rounded-md border border-zinc-200 bg-zinc-100/80 px-1.5 py-0.5 text-sm text-zinc-700">
          {tag}
        </span>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          {description}
        </p>
        <p className="mt-4 text-sm font-semibold">{setup}</p>
      </div>
      <div className="relative mt-4 h-[170px] w-full overflow-hidden">
        {illustration}
      </div>
    </li>
  );
}

export function DesktopStep({ onContinue, onSkip }: DesktopStepProps) {
  return (
    <OnboardingShell contentClassName="!justify-start !py-6 md:!py-8">
      <div className="flex w-full max-w-[900px] flex-col items-center gap-8">
        <OnboardingHeading
          title="Get the most out of Clauxen on your desktop"
          subtitle="With the desktop app, Clauxen can write code, work with your files, and automate tasks while you focus on other work."
        />

        <ul className="flex w-full max-w-[849px] list-none flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] md:flex-row">
          <FeatureColumn
            tag="For thinking"
            title="Chat"
            description="Ask questions, brainstorm, and tackle problems together."
            setup="No setup required"
            illustration={
              <div className="absolute left-5 top-7 z-10 max-w-[180px] rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
                Can you estimate revenue for 2026?
              </div>
            }
          />
          <FeatureColumn
            tag="For complex work"
            title="Collabry"
            description="Work across your files and apps. Build repeatable workflows."
            setup="Only on desktop"
            illustration={
              <div className="absolute inset-0 bg-[linear-gradient(#efeeeb_1px,transparent_1px),linear-gradient(90deg,#efeeeb_1px,transparent_1px)] bg-size-[17px_17px] opacity-50" />
            }
          />
          <FeatureColumn
            tag="For building"
            title="Code"
            description="Read, write, and fix code directly in your codebase."
            setup="Only on desktop"
            illustration={
              <div className="absolute bottom-4 left-5 right-5 overflow-hidden rounded-lg border border-[#1f1f1e] shadow-[0_2px_16px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-white px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="bg-white p-4 font-mono text-xs">
                  <p>
                    <span className="text-[#d97757]">&gt; </span>
                    Fix the auth bug in signup flow
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[#d97757]">
                    <span>✽</span>
                    <span>Contemplating…</span>
                  </p>
                </div>
              </div>
            }
          />
        </ul>

        <div className="flex w-full max-w-[450px] flex-col gap-3">
          <OnboardingPrimaryButton type="button" onClick={onContinue}>
            <span className="inline-flex items-center gap-2">
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12.44 17.52c-.19.62-.52 1.14-1.01 1.66-.49.52-1.14.8-1.9.8-2.74 0-1.08.44-2.05 1.16-2.74 1.72-.69 3.24-1.07 4.64-1.14.4-.02.8-.04 1.2-.04 1.4 0 2.21.07 3.02.42 3.71 1.02.41 1.66.63 2.12 1.02.41 2.7 0 3.02-.46 3.71-1.36.69-3.24 1.07-4.64 1.14-.4.02-.8.04-1.2.04-1.4 0-2.21-.07-3.02-.42-3.71-1.02-.41-1.66-.63-2.12-1.02-.41-2.7 0-3.02.46-3.71 1.36-.69 3.24-1.07 4.64-1.14.4.02.8.04 1.2.04 1.4 0 2.21.07 3.02.42 3.71 1.02.41 1.66.63 2.12 1.02.41 2.7 0 3.02-.46 3.71-1.36.69-3.24 1.07-4.64 1.14z" />
              </svg>
              Download for macOS
            </span>
          </OnboardingPrimaryButton>
          <OnboardingGhostButton type="button" onClick={onSkip}>
            Skip
          </OnboardingGhostButton>
        </div>
      </div>
    </OnboardingShell>
  );
}
