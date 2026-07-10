-- Persist structured onboarding answers alongside step/completion tracking.
alter table public.user_settings
  add column if not exists onboarding_answers jsonb not null default '{}'::jsonb;

comment on column public.user_settings.onboarding_answers is
  'Structured answers from first-run onboarding (consents, plan, name, role, training opt-in).';
