import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { query } from "@/server/db/pool";
import * as settingsRepo from "@/server/repositories/settings.repository";
import * as profileRepo from "@/server/repositories/profile.repository";
import * as profileService from "@/server/services/profile.service";
import { sidebarDisplayName } from "@/lib/profile-names";
import { sanitizeCustomInstructions } from "@/server/services/user-personalization.service";
import {
  cacheUserSettings,
  invalidateUserSettingsCache,
  readCachedUserSettings,
} from "@/server/cache/runtime-cache";
import { clampSidebarWidth } from "@/lib/sidebar-width";

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
  sidebarWidth: 288,
};

const defaultPersonalization = {
  personality: "Default",
  baseStyleTone: "Default",
  characteristicWarm: "Default",
  characteristicEnthusiastic: "Default",
  characteristicHeadersLists: "Default",
  characteristicEmoji: "Default",
  fastAnswers: true,
  customInstructions: "",
  fullName: "",
  nickname: "",
  occupation: "",
  moreAboutYou: "",
  referenceSavedMemories: true,
  referenceChatHistory: true,
  referenceRecordHistory: true,
  webSearch: true,
  extendedThinking: false,
};

const defaultNotifications = {
  desktopAlerts: true,
  soundEffects: false,
  responseCompletions: true,
  codexChannel: "Push",
  responseChannel: "Push",
  groupChatChannel: "Push",
  tasksChannel: "Push, Email",
  recommendationsChannel: "Push, Email",
  usageChannel: "Push, Email",
};

const defaultPrivacy = {
  locationMetadata: false,
  helpImproveModels: false,
};

const defaultCapabilities = {
  generateMemory: true,
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
  profile?: Awaited<ReturnType<typeof profileRepo.getProfile>> | null,
  onboardingAnswers?: Record<string, unknown> | null,
) {
  const personalization = mergeSettings(
    defaultPersonalization,
    stored.personalization as Record<string, unknown>,
  );

  // Prefer canonical profile columns, then fall back to onboarding answers.
  if (profile?.display_name) {
    personalization.fullName = profile.display_name;
  }
  if (profile?.preferred_name) {
    personalization.nickname = profile.preferred_name;
  } else if (
    !personalization.nickname &&
    typeof onboardingAnswers?.displayName === "string"
  ) {
    personalization.nickname = String(onboardingAnswers.displayName).trim();
  }
  if (
    !personalization.occupation &&
    typeof onboardingAnswers?.role === "string"
  ) {
    personalization.occupation = String(onboardingAnswers.role).trim();
  }

  if (typeof personalization.customInstructions === "string") {
    personalization.customInstructions = sanitizeCustomInstructions(
      personalization.customInstructions,
    );
  }

  return {
    general: mergeSettings(
      defaultGeneral,
      stored.general as Record<string, unknown>,
    ),
    personalization,
    profile: profile
      ? {
          avatarUrl: profileService.toClientAvatarUrl(profile),
          fullName: profile.display_name,
          preferredName: profile.preferred_name,
          sidebarName: sidebarDisplayName({
            fullName: profile.display_name,
            preferredName: profile.preferred_name,
            email: profile.email,
            authenticated: true,
          }),
        }
      : null,
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

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);

    const cached = await readCachedUserSettings<
      ReturnType<typeof toClientPayload>
    >(user.id);
    if (cached) {
      return jsonData(cached);
    }

    let stored: Record<string, unknown> = {};
    let notifStored: Record<string, unknown> = {};
    let profile: Awaited<ReturnType<typeof profileRepo.getProfile>> | null =
      null;
    let onboardingAnswers: Record<string, unknown> | null = null;

    try {
      const [userSettings, notificationPrefs, profileRow] = await Promise.all([
        settingsRepo.getUserSettings(user.id),
        settingsRepo.getNotificationPreferences(user.id),
        profileRepo.getProfile(user.id),
      ]);
      stored = (userSettings?.settings ?? {}) as Record<string, unknown>;
      notifStored = (notificationPrefs?.settings ?? {}) as Record<
        string,
        unknown
      >;
      profile = profileRow;
      onboardingAnswers =
        ((userSettings as { onboarding_answers?: Record<string, unknown> } | null)
          ?.onboarding_answers as Record<string, unknown> | null) ?? null;
    } catch (error) {
      // Return defaults rather than 500 — UI must stay usable during DB blips.
      console.error("[settings] read failed, returning defaults:", error);
    }

    const payload = toClientPayload(
      stored,
      notifStored,
      profile,
      onboardingAnswers,
    );
    void cacheUserSettings(user.id, payload);
    return jsonData(payload);
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    // A write can be the first product request after authentication. Seed only
    // the rows this route owns; full profile/workspace bootstrap belongs to the
    // auth/onboarding flow and must not run on every settings read.
    await settingsRepo.ensureSettingsRows(user.id, user.email);
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
        const patch = { ...body[key] } as Record<string, unknown>;
        if (
          key === "personalization" &&
          typeof patch.customInstructions === "string"
        ) {
          patch.customInstructions = sanitizeCustomInstructions(
            patch.customInstructions,
          );
        }
        if (key === "general" && "sidebarWidth" in patch) {
          patch.sidebarWidth = clampSidebarWidth(patch.sidebarWidth);
        }
        nextSettings[key] = {
          ...((currentSettings[key] as Record<string, unknown>) ?? {}),
          ...patch,
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

    const personalizationPatch = body.personalization;
    if (personalizationPatch) {
      const hasProfileField =
        typeof personalizationPatch.fullName === "string" ||
        typeof personalizationPatch.nickname === "string" ||
        typeof personalizationPatch.occupation === "string";
      if (hasProfileField) {
        await profileService.updateUserProfile(user.id, {
          fullName:
            typeof personalizationPatch.fullName === "string"
              ? personalizationPatch.fullName
              : undefined,
          preferredName:
            typeof personalizationPatch.nickname === "string"
              ? personalizationPatch.nickname
              : undefined,
          occupation:
            typeof personalizationPatch.occupation === "string"
              ? personalizationPatch.occupation
              : undefined,
        });
      }
    }

    const [userSettings, notificationPrefs, profile] = await Promise.all([
      settingsRepo.getUserSettings(user.id),
      settingsRepo.getNotificationPreferences(user.id),
      profileRepo.getProfile(user.id),
    ]);

    const stored = (userSettings?.settings ?? {}) as Record<string, unknown>;
    const notifStored = (notificationPrefs?.settings ?? {}) as Record<
      string,
      unknown
    >;
    const onboardingAnswers =
      ((userSettings as { onboarding_answers?: Record<string, unknown> } | null)
        ?.onboarding_answers as Record<string, unknown> | null) ?? null;

    const payload = toClientPayload(
      stored,
      notifStored,
      profile,
      onboardingAnswers,
    );
    await invalidateUserSettingsCache(user.id);
    void cacheUserSettings(user.id, payload);
    return jsonData(payload);
  },
  { requireAuth: true },
);
