-- Remove the retired first-run onboarding state from user_settings.
update public.user_settings
set consent_evidence = consent_evidence - 'onboarding'
where consent_evidence ? 'onboarding';

alter table public.user_settings
  drop constraint if exists user_settings_onboarding_step_check,
  drop column if exists onboarding_answers,
  drop column if exists onboarding_completed_at,
  drop column if exists onboarding_step;
