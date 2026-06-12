import { queryOne } from "@/backend/db/pool";

export type UserSettingsRow = {
  user_id: string;
  settings: Record<string, unknown>;
  theme: string;
  language: string;
  display_name: string | null;
};

export type NotificationPreferencesRow = {
  user_id: string;
  email_notifications: boolean;
  product_updates: boolean;
  research_complete: boolean;
  billing_alerts: boolean;
  security_alerts: boolean;
  settings: Record<string, unknown>;
};

export async function getUserSettings(userId: string) {
  return queryOne<UserSettingsRow>(
    `select user_id, settings, theme, language, display_name
     from public.user_settings where user_id = $1`,
    [userId],
  );
}

export async function getNotificationPreferences(userId: string) {
  return queryOne<NotificationPreferencesRow>(
    `select user_id, email_notifications, product_updates, research_complete,
            billing_alerts, security_alerts, settings
     from public.notification_preferences where user_id = $1`,
    [userId],
  );
}

export async function updateUserSettings(
  userId: string,
  patch: {
    settings?: Record<string, unknown>;
    theme?: string;
    language?: string;
  },
) {
  return queryOne<UserSettingsRow>(
    `update public.user_settings set
       settings = coalesce($2::jsonb, settings),
       theme = coalesce($3, theme),
       language = coalesce($4, language),
       updated_at = now()
     where user_id = $1
     returning user_id, settings, theme, language, display_name`,
    [
      userId,
      patch.settings ? JSON.stringify(patch.settings) : null,
      patch.theme ?? null,
      patch.language ?? null,
    ],
  );
}

export async function updateNotificationPreferences(
  userId: string,
  patch: {
    email_notifications?: boolean;
    product_updates?: boolean;
    research_complete?: boolean;
    billing_alerts?: boolean;
    security_alerts?: boolean;
    settings?: Record<string, unknown>;
  },
) {
  return queryOne<NotificationPreferencesRow>(
    `update public.notification_preferences set
       email_notifications = coalesce($2, email_notifications),
       product_updates = coalesce($3, product_updates),
       research_complete = coalesce($4, research_complete),
       billing_alerts = coalesce($5, billing_alerts),
       security_alerts = coalesce($6, security_alerts),
       settings = coalesce($7::jsonb, settings),
       updated_at = now()
     where user_id = $1
     returning user_id, email_notifications, product_updates, research_complete,
               billing_alerts, security_alerts, settings`,
    [
      userId,
      patch.email_notifications ?? null,
      patch.product_updates ?? null,
      patch.research_complete ?? null,
      patch.billing_alerts ?? null,
      patch.security_alerts ?? null,
      patch.settings ? JSON.stringify(patch.settings) : null,
    ],
  );
}
