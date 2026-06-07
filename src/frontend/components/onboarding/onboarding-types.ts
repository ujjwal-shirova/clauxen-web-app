export type OnboardingStep =
  | "create-account"
  | "plan-selection"
  | "desktop"
  | "before-chat"
  | "name"
  | "role";

export type OnboardingPlanId = "free" | "go" | "pro" | "max";

export interface OnboardingState {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  selectedPlanId: OnboardingPlanId;
  displayName: string;
  role: string;
  modelImprovementOptIn: boolean;
  verifiedEmail?: string;
}

export const ONBOARDING_STORAGE_KEY = "clauxen_onboarding_v1";

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  termsAccepted: false,
  privacyAccepted: false,
  marketingOptIn: false,
  selectedPlanId: "free",
  displayName: "",
  role: "",
  modelImprovementOptIn: true,
};
