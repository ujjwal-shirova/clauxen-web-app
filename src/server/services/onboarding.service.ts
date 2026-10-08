import { AppError, notFound } from "@/server/db/errors";
import * as onboardingRepo from "@/server/repositories/onboarding.repository";
import * as settingsRepo from "@/server/repositories/settings.repository";
import { ensureUserRecord } from "@/server/services/identity.service";
import * as profileService from "@/server/services/profile.service";
import { resolveAuthFullName } from "@/lib/profile-names";
import {
  ONBOARDING_STEPS,
  isOnboardingStep,
  type OnboardingStepId,
} from "@/lib/onboarding-steps";

const DEFAULT_STEP: OnboardingStepId = "create-account";

const ALLOWED_STEPS = new Set<string>(ONBOARDING_STEPS);

import {
  sanitizeAnswers,
  validateOnboardingCompletion,
} from "./onboarding-validation";
import type { OnboardingAnswers } from "@/lib/api/onboarding";
export type { OnboardingAnswers } from "@/lib/api/onboarding";

function toClientState(
  row: Awaited<ReturnType<typeof onboardingRepo.getOnboarding>>,
) {
  const rawStep = row?.onboarding_step ?? DEFAULT_STEP;
  return {
    step: isOnboardingStep(rawStep) ? rawStep : DEFAULT_STEP,
    completedAt: row?.onboarding_completed_at ?? null,
    completed: Boolean(row?.onboarding_completed_at),
    answers: (row?.onboarding_answers ?? {}) as Record<string, unknown>,
    steps: [...ONBOARDING_STEPS],
  };
}

export async function getOnboardingState(
  userId: string,
  email?: string | null,
) {
  let row = await onboardingRepo.getOnboarding(userId);
  if (!row && email) {
    await ensureUserRecord({ userId, email });
    row = await onboardingRepo.getOnboarding(userId);
  }
  return toClientState(row);
}

export async function updateOnboardingState(
  userId: string,
  input: {
    step?: string;
    completed?: boolean;
    answers?: OnboardingAnswers;
    email?: string | null;
    authMetadata?: Record<string, unknown> | null;
  },
) {
  if (
    input.step &&
    !isOnboardingStep(input.step) &&
    !ALLOWED_STEPS.has(input.step)
  ) {
    throw new AppError("Unknown onboarding step.", 400);
  }

  const answers = input.answers ? sanitizeAnswers(input.answers) : null;
  let current = await onboardingRepo.getOnboarding(userId);

  // New sessions can hit PATCH before ensureUserRecord finishes — seed the row.
  if (!current && input.email) {
    await ensureUserRecord({
      userId,
      email: input.email,
      displayName:
        typeof answers?.displayName === "string"
          ? (answers.displayName as string)
          : null,
    });
    current = await onboardingRepo.getOnboarding(userId);
  }

  if (!current) throw notFound("User settings not found.");

  const mergedAnswers = { ...current.onboarding_answers, ...answers };
  if (input.completed === true) validateOnboardingCompletion(mergedAnswers);

  const nextSettings = { ...(current.settings ?? {}) } as Record<
    string,
    unknown
  >;
  let settingsPatch: Record<string, unknown> | null = null;
  let displayName: string | null = null;
  let dataTrainingOptIn: boolean | null = null;
  let consentEvidence: Record<string, unknown> | null = null;

  if (answers) {
    const personalization = {
      ...((nextSettings.personalization as Record<string, unknown>) ?? {}),
    };

    if (typeof answers.displayName === "string" && answers.displayName) {
      displayName = answers.displayName as string;
      personalization.nickname = displayName;
    }
    if (typeof answers.role === "string") {
      personalization.occupation = answers.role;
    }
    if (typeof answers.responsePreference === "string") {
      personalization.responsePreference = answers.responsePreference;
    }
    if (typeof answers.customInstructions === "string") {
      personalization.customInstructions = answers.customInstructions;
    }
    if (
      typeof answers.responsePreference === "string" ||
      typeof answers.customInstructions === "string" ||
      typeof answers.displayName === "string" ||
      typeof answers.role === "string"
    ) {
      nextSettings.personalization = personalization;
      settingsPatch = nextSettings;
    }

    if (typeof answers.modelImprovementOptIn === "boolean") {
      dataTrainingOptIn = answers.modelImprovementOptIn;
      nextSettings.privacy = {
        ...((nextSettings.privacy as Record<string, unknown>) ?? {}),
        helpImproveModels: dataTrainingOptIn,
      };
      settingsPatch = nextSettings;
    }

    if (
      typeof answers.termsAccepted === "boolean" ||
      typeof answers.privacyAccepted === "boolean" ||
      typeof answers.marketingOptIn === "boolean" ||
      typeof answers.modelImprovementOptIn === "boolean"
    ) {
      consentEvidence = {
        onboarding: {
          termsAccepted: mergedAnswers.termsAccepted ?? null,
          privacyAccepted: mergedAnswers.privacyAccepted ?? null,
          marketingOptIn: mergedAnswers.marketingOptIn ?? null,
          modelImprovementOptIn: mergedAnswers.modelImprovementOptIn ?? null,
          disclosureVersion: "2026-10-08",
          capturedAt: new Date().toISOString(),
        },
      };
    }

    if (typeof answers.marketingOptIn === "boolean") {
      await settingsRepo.updateNotificationPreferences(userId, {
        product_updates: answers.marketingOptIn,
        email_notifications: answers.marketingOptIn,
      });
    }
  }

  const row = await onboardingRepo.updateOnboarding(userId, {
    onboardingStep: input.step ?? null,
    markCompleted: input.completed === true,
    onboardingAnswers: answers,
    settings: settingsPatch,
    dataTrainingOptIn,
    displayName,
    consentEvidence,
  });

  if (!row) throw notFound("User settings not found.");

  const authFullName = resolveAuthFullName(input.authMetadata);
  const preferredName =
    typeof answers?.displayName === "string"
      ? (answers.displayName as string)
      : null;
  const role =
    typeof answers?.role === "string" ? (answers.role as string) : null;

  if (preferredName || role) {
    await profileService.applyOnboardingProfile(userId, {
      preferredName,
      role,
      authFullName,
    });
  }

  return toClientState(row);
}
