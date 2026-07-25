import { query, queryOne } from "@/server/db/pool";

export type UserActivityDayRow = {
  activity_date: string;
  message_count: number;
};

export type UserClauxenInsightsRow = {
  user_id: string;
  self_growth_enabled: boolean;
  self_growth_enabled_at: string | null;
};

export async function getInsights(userId: string) {
  return queryOne<UserClauxenInsightsRow>(
    `select user_id, self_growth_enabled, self_growth_enabled_at
     from public.user_clauxen_insights
     where user_id = $1`,
    [userId],
  );
}

export async function ensureInsights(userId: string) {
  return queryOne<UserClauxenInsightsRow>(
    `insert into public.user_clauxen_insights (user_id)
     values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning user_id, self_growth_enabled, self_growth_enabled_at`,
    [userId],
  );
}

export async function setSelfGrowthEnabled(
  userId: string,
  enabled: boolean,
) {
  return queryOne<UserClauxenInsightsRow>(
    `insert into public.user_clauxen_insights (
       user_id, self_growth_enabled, self_growth_enabled_at, updated_at
     )
     values ($1, $2, case when $2 then now() else null end, now())
     on conflict (user_id) do update set
       self_growth_enabled = excluded.self_growth_enabled,
       self_growth_enabled_at = case
         when excluded.self_growth_enabled then coalesce(
           public.user_clauxen_insights.self_growth_enabled_at,
           now()
         )
         else null
       end,
       updated_at = now()
     returning user_id, self_growth_enabled, self_growth_enabled_at`,
    [userId, enabled],
  );
}

export async function listActivityDays(
  userId: string,
  fromDate: string,
  toDate: string,
) {
  return query<UserActivityDayRow>(
    `select activity_date::text, message_count
     from public.user_activity_days
     where user_id = $1
       and activity_date >= $2::date
       and activity_date <= $3::date
     order by activity_date asc`,
    [userId, fromDate, toDate],
  );
}

export async function countUserChats(userId: string) {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count
     from public.chats
     where user_id = $1
       and status <> 'deleted'`,
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function countUserMessages(userId: string) {
  const row = await queryOne<{ count: string }>(
    `select coalesce(sum(message_count), 0)::text as count
     from public.user_activity_days
     where user_id = $1`,
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function getProfileCreatedAt(userId: string) {
  const row = await queryOne<{ created_at: string; display_name: string | null; preferred_name: string | null }>(
    `select created_at, display_name, preferred_name
     from public.profiles
     where id = $1`,
    [userId],
  );
  return row;
}
