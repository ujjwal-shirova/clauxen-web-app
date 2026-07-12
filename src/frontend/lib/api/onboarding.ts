import { apiFetch } from "@/frontend/lib/api/client";

export type OnboardingAnswers = {
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  marketingOptIn?: boolean;
  modelImprovementOptIn?: boolean;
  displayName?: string;
  role?: string;
  selectedPlanId?: string;
  selectedBillingCycle?: string;
};

export type OnboardingApiState = {
  step: string | null;
  completed: boolean;
  completedAt: string | null;
  answers?: OnboardingAnswers;
  steps?: string[];
};

export async function getOnboarding() {
  return apiFetch<{ onboarding: OnboardingApiState }>("/api/v1/onboarding");
}

export async function updateOnboarding(patch: {
  step?: string;
  completed?: boolean;
  answers?: OnboardingAnswers;
}) {
  return apiFetch<{ onboarding: OnboardingApiState }>("/api/v1/onboarding", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function presignAvatarUpload(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return apiFetch<{
    fileId: string;
    uploadUrl: string;
    method: string;
  }>("/api/v1/files/presign", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      purpose: "avatar",
    }),
  });
}
