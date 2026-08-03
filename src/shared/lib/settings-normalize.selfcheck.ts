/**
 * Self-check for settings payload normalization.
 * Run: npx tsx src/lib/settings-normalize.selfcheck.ts
 */
import { normalizeAppSettings } from "./settings-normalize";
import { DEFAULT_APP_SETTINGS } from "./settings-defaults";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const fromNull = normalizeAppSettings(null);
assert(fromNull.general.appearancePreset === "System", "null → defaults");

const fromPartial = normalizeAppSettings({
  general: { appearancePreset: "Dark" },
  notifications: null,
});
assert(fromPartial.general.appearancePreset === "Dark", "partial general");
assert(
  fromPartial.notifications.desktopAlerts ===
    DEFAULT_APP_SETTINGS.notifications.desktopAlerts,
  "null section → defaults",
);

const fromBadClaw = normalizeAppSettings({ claw: { deployments: "nope" } });
assert(Array.isArray(fromBadClaw.claw.deployments), "bad claw → []");

console.log("settings-normalize self-check ok");
