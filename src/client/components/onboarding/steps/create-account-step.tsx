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
import { useAuth } from "@/hooks/use-auth";

type CreateAccountStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  verifiedEmail?: string;
  busy?: boolean;
};

export function CreateAccountStep({
  state,
  onChange,
  onContinue,
  verifiedEmail,
  busy = false,
}: CreateAccountStepProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const email = verifiedEmail ?? user?.email ?? null;
  const canSubmit = state.termsAccepted && state.privacyAccepted && !busy;

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
        <div className="w-full max-w-xl text-left text-sm text-zinc-500">
          {email ? (
            <p>
              Signed in as{" "}
              <span className="font-medium text-zinc-700">{email}</span>
            </p>
          ) : (
            <p>Your account is ready for setup.</p>
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
      <div className="flex w-full max-w-xl flex-col gap-8">
        <OnboardingHeading
          title="Welcome to Clauxen"
          subtitle="Make room for your next idea. First, review the essentials to finish setting up your account."
        />

        <OnboardingCard>
          <form
            className="flex flex-col gap-6 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onContinue();
            }}
          >
            <OnboardingCheckboxRow
              disabled={busy}
              checked={state.termsAccepted}
              onCheckedChange={(termsAccepted) => onChange({ termsAccepted })}
            >
              I agree to Clauxen&apos;s{" "}
              <OnboardingLink href="/legal/terms">
                Terms of Service
              </OnboardingLink>{" "}
              and{" "}
              <OnboardingLink href="/legal/terms#acceptable-use">
                Acceptable Use Policy
              </OnboardingLink>{" "}
              and confirm that I am at least 18 years of age.
            </OnboardingCheckboxRow>

            <OnboardingCheckboxRow
              disabled={busy}
              checked={state.privacyAccepted}
              onCheckedChange={(privacyAccepted) =>
                onChange({ privacyAccepted })
              }
            >
              I have read and acknowledge the{" "}
              <OnboardingLink href="/legal/privacy">
                Privacy Policy
              </OnboardingLink>
              .
            </OnboardingCheckboxRow>

            <OnboardingCheckboxRow
              disabled={busy}
              checked={state.marketingOptIn}
              onCheckedChange={(marketingOptIn) => onChange({ marketingOptIn })}
            >
              Send me occasional product news and tips. Optional — unsubscribe
              anytime.
            </OnboardingCheckboxRow>

            <OnboardingPrimaryButton
              type="submit"
              disabled={!canSubmit}
              className="mt-1"
            >
              {busy ? "Saving…" : "Agree and continue"}
            </OnboardingPrimaryButton>
          </form>
        </OnboardingCard>
      </div>
    </OnboardingShell>
  );
}
