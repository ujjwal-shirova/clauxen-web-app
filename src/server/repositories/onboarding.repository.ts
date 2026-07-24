import { query, queryOne } from "@/server/db/pool";

export type OnboardingRow = {
  user_id: string;
  onboarding_step: string | null;
  onboarding_completed_at: string | null;
  onboarding_answers: Record<string, unknown>;
  settings: Record<string, unknown>;
  data_training_opt_in: boolean;
  display_name: string | null;
};

export async function getOnboarding(userId: string) {
  return queryOne<OnboardingRow>(
    `select user_id, onboarding_step, onboarding_completed_at,
            coalesce(onboarding_answers, '{}'::jsonb) as onboarding_answers,
            coalesce(settings, '{}'::jsonb) as settings,
            coalesce(data_training_opt_in, false) as data_training_opt_in,
            display_name
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
    onboardingAnswers?: Record<string, unknown> | null;
    settings?: Record<string, unknown> | null;
    dataTrainingOptIn?: boolean | null;
    displayName?: string | null;
    consentEvidence?: Record<string, unknown> | null;
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
       onboarding_answers = case
         when $5::jsonb is null then onboarding_answers
         else coalesce(onboarding_answers, '{}'::jsonb) || $5::jsonb
       end,
       settings = coalesce($6::jsonb, settings),
       data_training_opt_in = coalesce($7, data_training_opt_in),
       personalization_training_enabled = coalesce($7, personalization_training_enabled),
       display_name = coalesce($8, display_name),
       consent_evidence = case
         when $9::jsonb is null then consent_evidence
         else coalesce(consent_evidence, '{}'::jsonb) || $9::jsonb
       end,
       consent_captured_at = case
         when $9::jsonb is null then consent_captured_at
         else now()
       end,
       updated_at = now()
     where user_id = $1
     returning user_id, onboarding_step, onboarding_completed_at,
               coalesce(onboarding_answers, '{}'::jsonb) as onboarding_answers,
               coalesce(settings, '{}'::jsonb) as settings,
               coalesce(data_training_opt_in, false) as data_training_opt_in,
               display_name`,
    [
      userId,
      patch.onboardingStep ?? null,
      completedAt,
      patch.markCompleted === true,
      patch.onboardingAnswers
        ? JSON.stringify(patch.onboardingAnswers)
        : null,
      patch.settings ? JSON.stringify(patch.settings) : null,
      patch.dataTrainingOptIn ?? null,
      patch.displayName ?? null,
      patch.consentEvidence
        ? JSON.stringify(patch.consentEvidence)
        : null,
    ],
  );
}

export async function updateProfileDisplayName(
  userId: string,
  displayName: string,
) {
  const profile = await queryOne<{ id: string; display_name: string | null }>(
    `update public.profiles
     set display_name = $2, updated_at = now()
     where id = $1
     returning id, display_name`,
    [userId, displayName],
  );

  // Keep auth metadata + settings row in sync for clients that read either.
  await query(
    `update auth.users
     set raw_user_meta_data =
           coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', $2::text),
         updated_at = now()
     where id = $1`,
    [userId, displayName],
  );

  await query(
    `update public.user_settings
     set display_name = $2, updated_at = now()
     where user_id = $1`,
    [userId, displayName],
  );

  return profile;
}
