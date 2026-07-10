import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { query } from "@/backend/db/pool";
import * as settingsRepo from "@/backend/repositories/settings.repository";
import { ensureUserRecord } from "@/backend/services/identity.service";

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
  motion: "System",
  voiceSpeed: "Normal",
  followUpSuggestions: true,
};

const defaultPersonalization = {
  personality: "Default",
  baseStyleTone: "Default",
  characteristicWarm: "Less",
  characteristicEnthusiastic: "Default",
  characteristicHeadersLists: "Less",
  characteristicEmoji: "Less",
  fastAnswers: true,
  customInstructions: "",
  fullName: "",
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
  responseCompletions: true,
  codexChannel: "Push",
  responseChannel: "Push",
  groupChatChannel: "Push",
  tasksChannel: "Push, Email",
  projectsChannel: "Email",
  recommendationsChannel: "Push, Email",
  usageChannel: "Push, Email",
};

const defaultPrivacy = {
  locationMetadata: false,
  helpImproveModels: false,
};

const defaultCapabilities = {
  generateMemory: true,
  connectorSearch: false,
  switchModelsWhenFlagged: false,
  artifacts: true,
  aiPoweredArtifacts: false,
  inlineVisualizations: false,
  codeExecution: true,
  networkEgress: true,
};

const defaultTimeAndFocus = {
  breakReminder: "-",
  breakSnooze: "-",
  quietHours: "-",
  quietDays: [false, false, false, false, false, false, false],
};

const defaultReflect = {
  range: "Past month",
};

const defaultSafety = {
  reduceSensitiveContent: true,
  mfaEnabled: false,
};

function mergeSettings<T extends Record<string, unknown>>(
  defaults: T,
  stored?: Record<string, unknown> | null,
): T {
  return { ...defaults, ...(stored ?? {}) } as T;
}

function toClientPayload(
  stored: Record<string, unknown>,
  notifStored: Record<string, unknown>,
) {
  return {
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
    privacy: mergeSettings(
      defaultPrivacy,
      stored.privacy as Record<string, unknown>,
    ),
    capabilities: mergeSettings(
      defaultCapabilities,
      stored.capabilities as Record<string, unknown>,
    ),
    timeAndFocus: mergeSettings(
      defaultTimeAndFocus,
      stored.timeAndFocus as Record<string, unknown>,
    ),
    reflect: mergeSettings(
      defaultReflect,
      stored.reflect as Record<string, unknown>,
    ),
    safety: mergeSettings(
      defaultSafety,
      stored.safety as Record<string, unknown>,
    ),
    claw: (stored.claw as { deployments?: unknown[] }) ?? { deployments: [] },
  };
}

async function bootstrapSettingsUser(user: {
  id: string;
  email?: string | null;
  displayName?: string | null;
}) {
  try {
    if (user.email) {
      await ensureUserRecord({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      });
      return;
    }
  } catch (error) {
    console.error("[settings] ensureUserRecord failed:", error);
  }

  await settingsRepo.ensureSettingsRows(user.id, user.email);
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    await bootstrapSettingsUser(user);

    const [userSettings, notificationPrefs] = await Promise.all([
      settingsRepo.getUserSettings(user.id),
      settingsRepo.getNotificationPreferences(user.id),
    ]);

    const stored = (userSettings?.settings ?? {}) as Record<string, unknown>;
    const notifStored = (notificationPrefs?.settings ?? {}) as Record<
      string,
      unknown
    >;

    return jsonData(toClientPayload(stored, notifStored));
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    await bootstrapSettingsUser(user);
    const body = (await request.json()) as {
      general?: Record<string, unknown>;
      personalization?: Record<string, unknown>;
      notifications?: Record<string, unknown>;
      privacy?: Record<string, unknown>;
      capabilities?: Record<string, unknown>;
      timeAndFocus?: Record<string, unknown>;
      reflect?: Record<string, unknown>;
      safety?: Record<string, unknown>;
      claw?: Record<string, unknown>;
    };

    const current = await settingsRepo.getUserSettings(user.id);
    const currentSettings = (current?.settings ?? {}) as Record<
      string,
      unknown
    >;

    const nextSettings: Record<string, unknown> = { ...currentSettings };
    for (const key of [
      "general",
      "personalization",
      "privacy",
      "capabilities",
      "timeAndFocus",
      "reflect",
      "safety",
      "claw",
    ] as const) {
      if (body[key]) {
        nextSettings[key] = {
          ...((currentSettings[key] as Record<string, unknown>) ?? {}),
          ...body[key],
        };
      }
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

    // Training opt-in from Privacy also mirrors the dedicated column when present.
    if (typeof body.privacy?.helpImproveModels === "boolean") {
      try {
        await query(
          `update public.user_settings
           set data_training_opt_in = $2, updated_at = now()
           where user_id = $1`,
          [user.id, body.privacy.helpImproveModels],
        );
      } catch {
        /* column may be unavailable in some envs */
      }
    }

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

    return jsonData(toClientPayload(stored, notifStored));
  },
  { requireAuth: true },
);
