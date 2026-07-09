import { apiFetch } from "@/frontend/lib/api/client";

export type OnboardingState = {
  step: string | null;
  completed: boolean;
  completedAt: string | null;
  settings?: Record<string, unknown>;
};

export async function getOnboarding() {
  return apiFetch<{ onboarding: OnboardingState }>("/api/v1/onboarding");
}

export async function updateOnboarding(patch: {
  step?: string;
  completed?: boolean;
}) {
  return apiFetch<{ onboarding: OnboardingState }>("/api/v1/onboarding", {
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
