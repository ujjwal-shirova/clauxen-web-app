-- Grandfather users who already used the product before the onboarding gate.
-- New signups keep onboarding_completed_at null until they finish the wizard.

update public.user_settings us
set
  onboarding_completed_at = coalesce(us.onboarding_completed_at, now()),
  onboarding_step = coalesce(nullif(us.onboarding_step, ''), 'role'),
  updated_at = now()
where us.onboarding_completed_at is null
  and exists (
    select 1
    from public.chats c
    where c.user_id = us.user_id
    limit 1
  );

-- Also complete users who already have a real display name + personalization
-- occupation (they used the app / settings before the gate existed).
update public.user_settings us
set
  onboarding_completed_at = coalesce(us.onboarding_completed_at, now()),
  onboarding_step = coalesce(nullif(us.onboarding_step, ''), 'role'),
  updated_at = now()
where us.onboarding_completed_at is null
  and (
    (
      coalesce(nullif(trim(us.display_name), ''), '') <> ''
      and us.display_name not ilike '%@%'
    )
    or coalesce(us.settings->'personalization'->>'occupation', '') <> ''
  );
