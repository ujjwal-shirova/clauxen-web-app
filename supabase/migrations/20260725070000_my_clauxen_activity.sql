-- My Clauxen: per-user daily activity + self-growth preference.
-- Activity auto-updates from chat_messages inserts (user role).

create table if not exists public.user_clauxen_insights (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  self_growth_enabled boolean not null default false,
  self_growth_enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_clauxen_insights is
  'My Clauxen preferences (self-growth) keyed by profile.';

create table if not exists public.user_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  message_count integer not null default 0
    check (message_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create index if not exists user_activity_days_user_date_idx
  on public.user_activity_days (user_id, activity_date desc);

comment on table public.user_activity_days is
  'Daily user-message counts for My Clauxen closeness heatmap.';

alter table public.user_clauxen_insights enable row level security;
alter table public.user_activity_days enable row level security;

drop policy if exists user_clauxen_insights_select_own on public.user_clauxen_insights;
create policy user_clauxen_insights_select_own
  on public.user_clauxen_insights
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_clauxen_insights_upsert_own on public.user_clauxen_insights;
create policy user_clauxen_insights_upsert_own
  on public.user_clauxen_insights
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_activity_days_select_own on public.user_activity_days;
create policy user_activity_days_select_own
  on public.user_activity_days
  for select
  to authenticated
  using (user_id = auth.uid());

-- Service role / triggers own writes; no insert policy for authenticated clients.

create or replace function public.bump_user_activity_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  day_utc date;
begin
  if new.role is distinct from 'user' then
    return new;
  end if;
  if new.user_id is null then
    return new;
  end if;

  day_utc := (timezone('utc', coalesce(new.created_at, now())))::date;

  insert into public.user_activity_days as d (user_id, activity_date, message_count, updated_at)
  values (new.user_id, day_utc, 1, now())
  on conflict (user_id, activity_date)
  do update set
    message_count = d.message_count + 1,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists chat_messages_bump_user_activity on public.chat_messages;
create trigger chat_messages_bump_user_activity
  after insert on public.chat_messages
  for each row
  execute function public.bump_user_activity_day();

-- Backfill from existing user messages (idempotent replace of aggregates).
insert into public.user_activity_days (user_id, activity_date, message_count, updated_at)
select
  m.user_id,
  (timezone('utc', m.created_at))::date as activity_date,
  count(*)::integer as message_count,
  now() as updated_at
from public.chat_messages m
where m.role = 'user'
  and m.user_id is not null
group by m.user_id, (timezone('utc', m.created_at))::date
on conflict (user_id, activity_date)
do update set
  message_count = excluded.message_count,
  updated_at = now();

insert into public.user_clauxen_insights (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

grant select on public.user_activity_days to authenticated;
grant select, insert, update on public.user_clauxen_insights to authenticated;
