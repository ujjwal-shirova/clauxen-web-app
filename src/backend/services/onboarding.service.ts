import { AppError, notFound } from "@/backend/db/errors";
import * as onboardingRepo from "@/backend/repositories/onboarding.repository";
import * as settingsRepo from "@/backend/repositories/settings.repository";
import { ensureUserRecord } from "@/backend/services/identity.service";
import * as profileService from "@/backend/services/profile.service";
import { resolveAuthFullName } from "@/lib/profile-names";
import {
  ONBOARDING_STEPS,
  isOnboardingStep,
  type OnboardingStepId,
} from "@/lib/onboarding-steps";

const DEFAULT_STEP: OnboardingStepId = "create-account";

const ALLOWED_STEPS = new Set<string>(ONBOARDING_STEPS);

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

function sanitizeAnswers(input: OnboardingAnswers): Record<string, unknown> {
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
  if (typeof input.selectedPlanId === "string") {
    out.selectedPlanId = input.selectedPlanId.trim().slice(0, 64);
  }
  if (typeof input.selectedBillingCycle === "string") {
    out.selectedBillingCycle = input.selectedBillingCycle.trim().slice(0, 16);
  }
  return out;
}

function toClientState(row: Awaited<ReturnType<typeof onboardingRepo.getOnboarding>>) {
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
  if (input.step && !isOnboardingStep(input.step) && !ALLOWED_STEPS.has(input.step)) {
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
    if (typeof answers.role === "string" && answers.role) {
      personalization.occupation = answers.role;
    }
    if (
      typeof answers.displayName === "string" ||
      typeof answers.role === "string"
    ) {
      nextSettings.personalization = personalization;
      settingsPatch = nextSettings;
    }

    if (typeof answers.modelImprovementOptIn === "boolean") {
      dataTrainingOptIn = answers.modelImprovementOptIn;
    }

    if (
      typeof answers.termsAccepted === "boolean" ||
      typeof answers.privacyAccepted === "boolean" ||
      typeof answers.marketingOptIn === "boolean" ||
      typeof answers.modelImprovementOptIn === "boolean"
    ) {
      consentEvidence = {
        onboarding: {
          termsAccepted: answers.termsAccepted ?? null,
          privacyAccepted: answers.privacyAccepted ?? null,
          marketingOptIn: answers.marketingOptIn ?? null,
          modelImprovementOptIn: answers.modelImprovementOptIn ?? null,
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
