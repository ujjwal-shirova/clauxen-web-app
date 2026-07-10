"use client";

import { useRouter } from "next/navigation";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingCard,
  OnboardingCheckboxRow,
  OnboardingHeading,
  OnboardingLink,
  OnboardingPrimaryButton,
} from "../onboarding-ui";
import { useAuth } from "@/frontend/hooks/use-auth";

type CreateAccountStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  verifiedEmail?: string;
};

export function CreateAccountStep({
  state,
  onChange,
  onContinue,
  verifiedEmail,
}: CreateAccountStepProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const email = verifiedEmail ?? user?.email ?? null;
  const canSubmit = state.termsAccepted && state.privacyAccepted;

  const handleDifferentEmail = async () => {
    try {
      await logout();
    } catch {
      /* still send them to login */
    }
    router.replace("/login");
  };

  return (
    <OnboardingShell
      footer={
        <div className="w-full max-w-[450px] text-center text-sm text-zinc-500">
          {email ? (
            <p>
              Email verified as{" "}
              <span className="font-medium text-zinc-700">{email}</span>
            </p>
          ) : (
            <p>Verifying your email…</p>
          )}
          <button
            type="button"
            onClick={() => void handleDifferentEmail()}
            className="mt-1 inline-block underline decoration-zinc-400/40 underline-offset-[3px] hover:text-zinc-700"
          >
            Use a different email
          </button>
        </div>
      }
    >
      <div className="flex w-full max-w-[450px] flex-col items-center gap-5">
        <OnboardingHeading
          title="Let's create your account"
          subtitle="A few things for you to review"
        />

        <OnboardingCard>
          <form
            className="flex flex-col gap-3 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onContinue();
            }}
          >
            <OnboardingCheckboxRow
              checked={state.termsAccepted}
              onCheckedChange={(termsAccepted) => onChange({ termsAccepted })}
            >
              I agree to Clauxen&apos;s{" "}
              <OnboardingLink href="/legal/terms">
                Terms of Service
              </OnboardingLink>{" "}
              and{" "}
              <OnboardingLink href="/legal/acceptable-use">
                Acceptable Use Policy
              </OnboardingLink>{" "}
              and confirm that I am at least 18 years of age.
            </OnboardingCheckboxRow>

            <OnboardingCheckboxRow
              checked={state.privacyAccepted}
              onCheckedChange={(privacyAccepted) =>
                onChange({ privacyAccepted })
              }
            >
              I consent to collection and use of my personal information in
              accordance with the{" "}
              <OnboardingLink href="/legal/privacy">
                Privacy Policy
              </OnboardingLink>
              .
            </OnboardingCheckboxRow>

            <OnboardingCheckboxRow
              checked={state.marketingOptIn}
              onCheckedChange={(marketingOptIn) => onChange({ marketingOptIn })}
            >
              Subscribe to occasional promotional emails and notifications. You
              can opt out any time.
            </OnboardingCheckboxRow>

            <OnboardingPrimaryButton
              type="submit"
              disabled={!canSubmit}
              className="mt-1"
            >
              Create account
            </OnboardingPrimaryButton>
          </form>
        </OnboardingCard>
      </div>
    </OnboardingShell>
  );
}
