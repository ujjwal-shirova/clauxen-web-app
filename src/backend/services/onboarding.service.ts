import { AppError, notFound } from "@/backend/db/errors";
import * as onboardingRepo from "@/backend/repositories/onboarding.repository";
import * as settingsRepo from "@/backend/repositories/settings.repository";

const DEFAULT_STEP = "create-account";

const ALLOWED_STEPS = new Set([
  "create-account",
  "plan-selection",
  "desktop",
  "before-chat",
  "name",
  "role",
]);

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
  return {
    step: row?.onboarding_step ?? DEFAULT_STEP,
    completedAt: row?.onboarding_completed_at ?? null,
    completed: Boolean(row?.onboarding_completed_at),
    answers: (row?.onboarding_answers ?? {}) as Record<string, unknown>,
  };
}

export async function getOnboardingState(userId: string) {
  const row = await onboardingRepo.getOnboarding(userId);
  return toClientState(row);
}

export async function updateOnboardingState(
  userId: string,
  input: {
    step?: string;
    completed?: boolean;
    answers?: OnboardingAnswers;
  },
) {
  if (input.step && !ALLOWED_STEPS.has(input.step)) {
    throw new AppError("Unknown onboarding step.", 400);
  }

  const answers = input.answers ? sanitizeAnswers(input.answers) : null;
  const current = await onboardingRepo.getOnboarding(userId);
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

  if (displayName) {
    await onboardingRepo.updateProfileDisplayName(userId, displayName);
  }

  return toClientState(row);
}
