import type { OnboardingPlanId } from "@/lib/plans-catalog";

export type { OnboardingPlanId };

export type OnboardingStep =
  | "create-account"
  | "plan-selection"
  | "desktop"
  | "before-chat"
  | "name"
  | "role";

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
