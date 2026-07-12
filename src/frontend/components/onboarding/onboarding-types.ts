import type { OnboardingPlanId } from "@/lib/plans-catalog";
import type { OnboardingStepId } from "@/lib/onboarding-steps";

export type { OnboardingPlanId };

export type OnboardingStep = OnboardingStepId;

export interface OnboardingState {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  selectedPlanId: OnboardingPlanId | string;
  selectedBillingCycle: "monthly" | "yearly";
  displayName: string;
  role: string;
  modelImprovementOptIn: boolean;
  verifiedEmail?: string;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  termsAccepted: false,
  privacyAccepted: false,
  marketingOptIn: false,
  selectedPlanId: "free",
  selectedBillingCycle: "monthly",
  displayName: "",
  role: "",
  modelImprovementOptIn: true,
};
