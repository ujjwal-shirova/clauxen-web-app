import { AppError } from "@/server/db/errors";
import type { OnboardingAnswers } from "@/lib/api/onboarding";

export function sanitizeAnswers(
  input: OnboardingAnswers,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof input.termsAccepted === "boolean") {
    out.termsAccepted = input.termsAccepted;
  }
  if (typeof input.privacyAccepted === "boolean") {
    out.privacyAccepted = input.privacyAccepted;
  }
  if (typeof input.marketingOptIn === "boolean") {
    out.marketingOptIn = input.marketingOptIn;
  }
  if (typeof input.modelImprovementOptIn === "boolean") {
    out.modelImprovementOptIn = input.modelImprovementOptIn;
  }
  if (typeof input.displayName === "string") {
    out.displayName = input.displayName.trim().slice(0, 120);
  }
  if (typeof input.role === "string") {
    out.role = input.role.trim().slice(0, 120);
  }
  if (
    ["balanced", "concise", "detailed"].includes(input.responsePreference ?? "")
  ) {
    out.responsePreference = input.responsePreference;
  }
  if (typeof input.customInstructions === "string") {
    out.customInstructions = input.customInstructions.trim().slice(0, 1500);
  }
  if (typeof input.selectedPlanId === "string") {
    out.selectedPlanId = input.selectedPlanId.trim().slice(0, 64);
  }
  if (typeof input.selectedBillingCycle === "string") {
    out.selectedBillingCycle = input.selectedBillingCycle.trim().slice(0, 16);
  }
  return out;
}

export function validateOnboardingCompletion(
  mergedAnswers: Record<string, unknown>,
) {
  if (
    mergedAnswers.termsAccepted !== true ||
    mergedAnswers.privacyAccepted !== true
  ) {
    throw new AppError(
      "Please review and accept the terms and privacy policy in Welcome.",
      400,
    );
  }
  if (typeof mergedAnswers.modelImprovementOptIn !== "boolean") {
    throw new AppError(
      "Please choose whether to allow model training in Data & privacy.",
      400,
    );
  }
  if (
    typeof mergedAnswers.displayName !== "string" ||
    !mergedAnswers.displayName.trim()
  ) {
    throw new AppError("Please enter your preferred name in About you.", 400);
  }
}
