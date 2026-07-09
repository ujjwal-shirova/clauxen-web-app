import { queryOne } from "@/backend/db/pool";

export type OnboardingRow = {
  user_id: string;
  onboarding_step: string | null;
  onboarding_completed_at: string | null;
};

export async function getOnboarding(userId: string) {
  return queryOne<OnboardingRow>(
    `select user_id, onboarding_step, onboarding_completed_at
     from public.user_settings
     where user_id = $1`,
    [userId],
  );
}

export async function updateOnboarding(
  userId: string,
  patch: {
    onboardingStep?: string | null;
    onboardingCompletedAt?: string | null;
    markCompleted?: boolean;
  },
) {
  const completedAt = patch.markCompleted
    ? new Date().toISOString()
    : (patch.onboardingCompletedAt ?? null);

  return queryOne<OnboardingRow>(
    `update public.user_settings set
       onboarding_step = coalesce($2, onboarding_step),
       onboarding_completed_at = case
         when $4::boolean then coalesce($3::timestamptz, now())
         when $3::timestamptz is not null then $3::timestamptz
         else onboarding_completed_at
       end,
       updated_at = now()
     where user_id = $1
     returning user_id, onboarding_step, onboarding_completed_at`,
    [
      userId,
      patch.onboardingStep ?? null,
      completedAt,
      patch.markCompleted === true,
    ],
  );
}
