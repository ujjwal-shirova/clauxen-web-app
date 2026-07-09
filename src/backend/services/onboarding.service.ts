import { AppError, notFound } from "@/backend/db/errors";
import * as onboardingRepo from "@/backend/repositories/onboarding.repository";

const DEFAULT_STEP = "create-account";

const ALLOWED_STEPS = new Set([
  "create-account",
  "plan-selection",
  "desktop",
  "before-chat",
  "name",
  "role",
]);

export async function getOnboardingState(userId: string) {
  const row = await onboardingRepo.getOnboarding(userId);
  return {
    step: row?.onboarding_step ?? DEFAULT_STEP,
    completedAt: row?.onboarding_completed_at ?? null,
    completed: Boolean(row?.onboarding_completed_at),
  };
}

export async function updateOnboardingState(
  userId: string,
  input: { step?: string; completed?: boolean },
) {
  if (input.step && !ALLOWED_STEPS.has(input.step)) {
    throw new AppError("Unknown onboarding step.", 400);
  }

  const row = await onboardingRepo.updateOnboarding(userId, {
    onboardingStep: input.step ?? null,
    markCompleted: input.completed === true,
  });

  if (!row) throw notFound("User settings not found.");

  return {
    step: row.onboarding_step ?? DEFAULT_STEP,
    completedAt: row.onboarding_completed_at,
    completed: Boolean(row.onboarding_completed_at),
  };
}
