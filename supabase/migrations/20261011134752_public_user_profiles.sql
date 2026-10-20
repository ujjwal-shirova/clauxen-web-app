-- Public user profile identity and visibility controls.
alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_shape text not null default 'circle',
  add column if not exists show_usage_statistics boolean not null default true,
  add column if not exists show_activity_graph boolean not null default true,
  add column if not exists show_top_plugins boolean not null default true,
  add column if not exists show_insights boolean not null default true;

-- Give existing accounts a stable handle from their real account identity.
with candidates as (
  select id, base,
    count(*) over (partition by base) as name_count
  from (
    select id, left(coalesce(
      nullif(trim(both '_' from lower(regexp_replace(
        case when lower(coalesce(display_name, '')) = lower(split_part(coalesce(email, ''), '@', 1))
          then 'user_' || substr(replace(id::text, '-', ''), 1, 8)
          else coalesce(nullif(display_name, ''), 'user') end,
        '[^a-zA-Z0-9]+', '_', 'g'
      ))), ''), 'user'), 32) as base
    from public.profiles where username is null
  ) normalized
)
update public.profiles p
set username = case when c.name_count = 1 then c.base
  else left(c.base, 23) || '_' || substr(replace(p.id::text, '-', ''), 1, 8)
  end
from candidates c
where c.id = p.id;

alter table public.profiles alter column username set not null;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9_]{3,32}$');
alter table public.profiles
  add constraint profiles_avatar_shape_check
  check (avatar_shape in ('circle', 'squircle', 'rounded', 'oval', 'scallop'));
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

comment on column public.profiles.username is
  'Public profile handle used in /u/{username} URLs.';

-- Auth provisioning inserts into profiles without specifying username. Assign
-- one at the database boundary so every new account gets a routable handle.
create or replace function public.assign_profile_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_username text;
begin
  if new.username is not null then
    return new;
  end if;
  base_username := trim(both '_' from lower(regexp_replace(
    case when lower(coalesce(new.display_name, '')) = lower(split_part(coalesce(new.email, ''), '@', 1))
      then 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
      else coalesce(nullif(new.display_name, ''), 'user') end,
    '[^a-zA-Z0-9]+', '_', 'g'
  )));
  if char_length(base_username) < 3 then base_username := 'user'; end if;
  base_username := left(base_username, 32);
  if exists (select 1 from public.profiles p where lower(p.username) = lower(base_username)) then
    base_username := left(base_username, 23) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  new.username := base_username;
  return new;
end;
$$;

drop trigger if exists profiles_assign_username on public.profiles;
create trigger profiles_assign_username
before insert on public.profiles
for each row execute function public.assign_profile_username();
