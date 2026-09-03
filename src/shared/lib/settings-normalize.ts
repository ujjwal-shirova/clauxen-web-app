import {
  PLUGIN_PERMISSION_MODES,
  type AppSettings,
  type PluginSettings,
} from "@/lib/api/settings";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings-defaults";
import { normalizeChatFontId } from "@/lib/app-preferences";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeSection<T extends Record<string, unknown>>(
  defaults: T,
  stored: unknown,
): T {
  if (!isRecord(stored)) return { ...defaults };
  return { ...defaults, ...stored } as T;
}

/** Always returns a complete AppSettings — never null/partial from bad API payloads. */
export function normalizeAppSettings(raw: unknown): AppSettings {
  const data = isRecord(raw) ? raw : {};
  const clawRaw = isRecord(data.claw) ? data.claw : {};
  const deployments = Array.isArray(clawRaw.deployments)
    ? clawRaw.deployments
    : [];

  const general = mergeSection(DEFAULT_APP_SETTINGS.general, data.general);
  general.chatFont = normalizeChatFontId(general.chatFont);

  return {
    general,
    personalization: mergeSection(
      DEFAULT_APP_SETTINGS.personalization,
      data.personalization,
    ),
    notifications: mergeSection(
      DEFAULT_APP_SETTINGS.notifications,
      data.notifications,
    ),
    privacy: mergeSection(DEFAULT_APP_SETTINGS.privacy, data.privacy),
    capabilities: mergeSection(
      DEFAULT_APP_SETTINGS.capabilities,
      data.capabilities,
    ),
    timeAndFocus: mergeSection(
      DEFAULT_APP_SETTINGS.timeAndFocus,
      data.timeAndFocus,
    ),
    reflect: mergeSection(DEFAULT_APP_SETTINGS.reflect, data.reflect),
    safety: mergeSection(DEFAULT_APP_SETTINGS.safety, data.safety),
    plugins: normalizePluginSettings(data.plugins),
    claw: { deployments: deployments as AppSettings["claw"]["deployments"] },
  };
}

function normalizePluginSettings(stored: unknown): PluginSettings {
  const merged = mergeSection(DEFAULT_APP_SETTINGS.plugins, stored);
  if (
    !PLUGIN_PERMISSION_MODES.includes(
      merged.permissionMode as PluginSettings["permissionMode"],
    )
  ) {
    merged.permissionMode = DEFAULT_APP_SETTINGS.plugins.permissionMode;
  }
  merged.developerMode = Boolean(merged.developerMode);
  return merged;
}
