import { query, queryOne, withTransaction } from "@/server/db/pool";
import type { CookieConsentSource } from "@/lib/cookie-consent";

export type CookieConsentRow = {
  id: string;
  visitor_id: string;
  user_id: string | null;
  essential: boolean;
  performance: boolean;
  advertising: boolean;
  source: CookieConsentSource;
  country_code: string | null;
  created_at: string;
  updated_at: string;
};

export async function getConsentByVisitorId(visitorId: string) {
  return queryOne<CookieConsentRow>(
    `select id, visitor_id, user_id, essential, performance, advertising, source,
            country_code, created_at, updated_at
     from public.cookie_consents
     where visitor_id = $1`,
    [visitorId],
  );
}

export async function getLatestConsentByUserId(userId: string) {
  return queryOne<CookieConsentRow>(
    `select id, visitor_id, user_id, essential, performance, advertising, source,
            country_code, created_at, updated_at
     from public.cookie_consents
     where user_id = $1
     order by updated_at desc
     limit 1`,
    [userId],
  );
}

export async function saveConsent(input: {
  visitorId: string;
  userId?: string | null;
  performance: boolean;
  advertising: boolean;
  source: CookieConsentSource;
  countryCode?: string | null;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<CookieConsentRow>(
      `insert into public.cookie_consents (
         visitor_id, user_id, essential, performance, advertising, source, country_code
       ) values ($1, $2, true, $3, $4, $5, $6)
       on conflict (visitor_id) do update
         set user_id = coalesce(excluded.user_id, public.cookie_consents.user_id),
             performance = excluded.performance,
             advertising = excluded.advertising,
             source = excluded.source,
             country_code = coalesce(excluded.country_code, public.cookie_consents.country_code),
             updated_at = now()
       returning id, visitor_id, user_id, essential, performance, advertising, source,
                 country_code, created_at, updated_at`,
      [
        input.visitorId,
        input.userId ?? null,
        input.performance,
        input.advertising,
        input.source,
        input.countryCode ?? null,
      ],
    );

    const revokedCategories: string[] = [];
    if (!input.performance) revokedCategories.push("performance");
    if (!input.advertising) revokedCategories.push("advertising");

    if (revokedCategories.length > 0) {
      if (input.userId) {
        await client.query(
          `delete from public.cookie_events
           where category = any($1::text[])
             and (visitor_id = $2 or user_id = $3)`,
          [revokedCategories, input.visitorId, input.userId],
        );
      } else {
        await client.query(
          `delete from public.cookie_events
           where visitor_id = $1 and category = any($2::text[])`,
          [input.visitorId, revokedCategories],
        );
      }
    }

    return result.rows[0] ?? null;
  });
}

export async function insertEvent(input: {
  visitorId: string;
  userId?: string | null;
  category: "performance" | "advertising";
  eventType: string;
  path?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  countryCode?: string | null;
  payload?: Record<string, unknown>;
}) {
  return queryOne<{ id: string }>(
    `insert into public.cookie_events (
       visitor_id, user_id, category, event_type, path, referrer,
       utm_source, utm_medium, utm_campaign, country_code, payload
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     returning id`,
    [
      input.visitorId,
      input.userId ?? null,
      input.category,
      input.eventType,
      input.path ?? null,
      input.referrer ?? null,
      input.utmSource ?? null,
      input.utmMedium ?? null,
      input.utmCampaign ?? null,
      input.countryCode ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

export async function deleteAllForUser(userId: string) {
  await query(`delete from public.cookie_events where user_id = $1`, [userId]);
  await query(`delete from public.cookie_consents where user_id = $1`, [
    userId,
  ]);
}
