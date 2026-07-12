-- Harden onboarding step tracking for hash-deep-linkable wizard steps.
-- Aligns defaults with the app's OnboardingStepId union.

alter table public.user_settings
  alter column onboarding_step set default 'create-account';

update public.user_settings
set onboarding_step = 'create-account'
where onboarding_step is null
   or onboarding_step = ''
   or onboarding_step = 'welcome';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_onboarding_step_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_onboarding_step_check
      check (
        onboarding_step is null
        or onboarding_step in (
          'create-account',
          'plan-selection',
          'desktop',
          'before-chat',
          'name',
          'role'
        )
      );
  end if;
end $$;

comment on column public.user_settings.onboarding_step is
  'Current onboarding wizard step (create-account, plan-selection, desktop, before-chat, name, role). Mirrored in the URL as /onboarding#<step>.';
