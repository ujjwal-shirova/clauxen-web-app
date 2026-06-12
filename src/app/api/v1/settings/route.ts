import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as settingsRepo from "@/backend/repositories/settings.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultGeneral = {
  colorMode: "auto",
  chatFont: "Default",
  appearancePreset: "System",
  contrastMode: "System",
  accentColor: "Blue",
  language: "Auto-detect",
  spokenLanguage: "Auto-detect",
  voice: "Ember",
  voiceIsolation: false,
  dictationEnabled: true,
  toolMode: "auto",
};

const defaultPersonalization = {
  baseStyleTone: "Default",
  characteristicWarm: "Less",
  characteristicEnthusiastic: "Default",
  characteristicHeadersLists: "Less",
  characteristicEmoji: "Less",
  fastAnswers: true,
  customInstructions: "",
  nickname: "",
  occupation: "",
  moreAboutYou: "",
  referenceSavedMemories: true,
  referenceChatHistory: true,
  referenceRecordHistory: true,
};

const defaultNotifications = {
  desktopAlerts: true,
  soundEffects: false,
  codexChannel: "Push",
  responseChannel: "Push",
  groupChatChannel: "Push",
  tasksChannel: "Push, Email",
  projectsChannel: "Email",
  recommendationsChannel: "Push, Email",
  usageChannel: "Push, Email",
};

function mergeSettings<T extends Record<string, unknown>>(
  defaults: T,
  stored?: Record<string, unknown> | null,
): T {
  return { ...defaults, ...(stored ?? {}) } as T;
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const [userSettings, notificationPrefs] = await Promise.all([
      settingsRepo.getUserSettings(user.id),
      settingsRepo.getNotificationPreferences(user.id),
    ]);

    const stored = (userSettings?.settings ?? {}) as Record<string, unknown>;
    const notifStored = (notificationPrefs?.settings ?? {}) as Record<
      string,
      unknown
    >;

    return jsonData({
      general: mergeSettings(
        defaultGeneral,
        stored.general as Record<string, unknown>,
      ),
      personalization: mergeSettings(
        defaultPersonalization,
        stored.personalization as Record<string, unknown>,
      ),
      notifications: mergeSettings(
        defaultNotifications,
        notifStored.channels as Record<string, unknown>,
      ),
      claw: (stored.claw as { deployments?: unknown[] }) ?? { deployments: [] },
    });
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      general?: Record<string, unknown>;
      personalization?: Record<string, unknown>;
      notifications?: Record<string, unknown>;
      claw?: Record<string, unknown>;
    };

    const current = await settingsRepo.getUserSettings(user.id);
    const currentSettings = (current?.settings ?? {}) as Record<
      string,
      unknown
    >;

    const nextSettings: Record<string, unknown> = { ...currentSettings };
    if (body.general) {
      nextSettings.general = {
        ...((currentSettings.general as Record<string, unknown>) ?? {}),
        ...body.general,
      };
    }
    if (body.claw) {
      nextSettings.claw = {
        ...((currentSettings.claw as Record<string, unknown>) ?? {}),
        ...body.claw,
      };
    }
    if (body.personalization) {
      nextSettings.personalization = {
        ...((currentSettings.personalization as Record<string, unknown>) ?? {}),
        ...body.personalization,
      };
    }

    const theme =
      typeof body.general?.appearancePreset === "string"
        ? String(body.general.appearancePreset).toLowerCase()
        : undefined;
    const language =
      typeof body.general?.language === "string"
        ? String(body.general.language)
        : undefined;

    await settingsRepo.updateUserSettings(user.id, {
      settings: nextSettings,
      theme,
      language: language && language !== "Auto-detect" ? language : undefined,
    });

    if (body.notifications) {
      const notifCurrent = await settingsRepo.getNotificationPreferences(
        user.id,
      );
      const notifSettings = (notifCurrent?.settings ?? {}) as Record<
        string,
        unknown
      >;
      await settingsRepo.updateNotificationPreferences(user.id, {
        settings: {
          ...notifSettings,
          channels: {
            ...((notifSettings.channels as Record<string, unknown>) ?? {}),
            ...body.notifications,
          },
        },
        email_notifications:
          typeof body.notifications.desktopAlerts === "boolean"
            ? body.notifications.desktopAlerts
            : undefined,
      });
    }

    const [userSettings, notificationPrefs] = await Promise.all([
      settingsRepo.getUserSettings(user.id),
      settingsRepo.getNotificationPreferences(user.id),
    ]);

    const stored = (userSettings?.settings ?? {}) as Record<string, unknown>;
    const notifStored = (notificationPrefs?.settings ?? {}) as Record<
      string,
      unknown
    >;

    return jsonData({
      general: mergeSettings(
        defaultGeneral,
        stored.general as Record<string, unknown>,
      ),
      personalization: mergeSettings(
        defaultPersonalization,
        stored.personalization as Record<string, unknown>,
      ),
      notifications: mergeSettings(
        defaultNotifications,
        notifStored.channels as Record<string, unknown>,
      ),
      claw: (stored.claw as { deployments?: unknown[] }) ?? { deployments: [] },
    });
  },
  { requireAuth: true },
);
