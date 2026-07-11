-- preferred_name = what Clauxen calls the user; display_name = full / account name.
alter table public.profiles
  add column if not exists preferred_name text;

comment on column public.profiles.preferred_name is
  'Short name Clauxen uses in greetings (onboarding nickname).';

-- Backfill from settings JSON and onboarding answers where possible.
update public.profiles p
set preferred_name = coalesce(
  nullif(trim(p.preferred_name), ''),
  nullif(trim(us.settings -> 'personalization' ->> 'nickname'), ''),
  nullif(trim(us.onboarding_answers ->> 'displayName'), '')
)
from public.user_settings us
where us.user_id = p.id
  and (p.preferred_name is null or trim(p.preferred_name) = '');

update public.profiles p
set display_name = coalesce(
  nullif(trim(p.display_name), ''),
  nullif(trim(us.settings -> 'personalization' ->> 'fullName'), ''),
  nullif(trim(us.onboarding_answers ->> 'displayName'), '')
)
from public.user_settings us
where us.user_id = p.id
  and (p.display_name is null or trim(p.display_name) = '' or p.display_name = split_part(p.email, '@', 1));
