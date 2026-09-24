import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Blocks,
  Code2,
  CreditCard,
  Database,
  LockKeyhole,
  ScrollText,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";

/**
 * Settings IA — 10 sections in 3 groups.
 *
 * - General absorbs Keyboard shortcuts.
 * - Personalization absorbs Reflect activity range.
 * - Notifications absorbs Time and focus (breaks + quiet hours).
 * - Account owns profile, organization, linked accounts, and deletion.
 * - Security & login owns sign-in methods, 2-step, passkeys, sessions.
 * - Data controls owns model training, history, export, storage, safety.
 * - Billing absorbs Storage quota.
 */
export const settingsNav = [
  { name: "General", icon: Settings2 },
  { name: "Personalization", icon: Sparkles },
  { name: "Notifications", icon: Bell },
  { name: "Account", icon: UserRound },
  { name: "Security & login", icon: LockKeyhole },
  { name: "Data controls", icon: Database },
  { name: "Billing", icon: CreditCard },
  { name: "Capabilities", icon: Blocks },
  { name: "Skills", icon: ScrollText },
  { name: "Clauxen Code", icon: Code2 },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

export type VisibleSettingsTab = (typeof settingsNav)[number]["name"];

/** Removed top-level tabs — still accepted for deep links and old hashes. */
export type LegacySettingsTab =
  | "Security"
  | "Privacy & safety"
  | "Privacy"
  | "Reflect"
  | "Time and focus"
  | "Safety"
  | "Parental controls"
  | "Trusted contact"
  | "Storage"
  | "Keyboard"
  | "Enterprise"
  | "Voice";

export type SettingsTab = VisibleSettingsTab | LegacySettingsTab;

/** Map any accepted tab (visible or legacy) to the visible section. */
export function resolveVisibleTab(tab: string): VisibleSettingsTab {
  switch (tab) {
    case "General":
    case "Personalization":
    case "Notifications":
    case "Account":
    case "Security & login":
    case "Data controls":
    case "Billing":
    case "Capabilities":
    case "Skills":
    case "Clauxen Code":
      return tab;
    case "Security":
      return "Security & login";
    case "Privacy & safety":
    case "Privacy":
    case "Safety":
    case "Parental controls":
    case "Trusted contact":
      return "Data controls";
    case "Reflect":
      return "Personalization";
    case "Time and focus":
      return "Notifications";
    case "Storage":
      return "Billing";
    case "Keyboard":
    case "Enterprise":
    case "Voice":
      return "General";
    default:
      return "General";
  }
}

const visibleDescriptions: Record<VisibleSettingsTab, string> = {
  General: "Appearance, reading, and keyboard shortcuts.",
  Personalization: "How Clauxen responds and what it remembers.",
  Notifications: "What you hear about, and when to stay quiet.",
  Account: "Your profile, organization, and linked accounts.",
  "Security & login": "Sign-in methods, 2-step verification, and sessions.",
  "Data controls": "Training, chat history, exports, and content safety.",
  Billing: "Plan, usage, invoices, and payment methods.",
  Capabilities: "Memory, tools, and what Clauxen can do.",
  Skills: "Reusable instructions Clauxen follows.",
  "Clauxen Code": "Terminal and IDE coding sessions.",
};

export const settingsTabDescriptions: Record<SettingsTab, string> = {
  ...visibleDescriptions,
  Security: visibleDescriptions["Security & login"],
  "Privacy & safety": visibleDescriptions["Data controls"],
  Privacy: visibleDescriptions["Data controls"],
  Safety: visibleDescriptions["Data controls"],
  "Parental controls": visibleDescriptions["Data controls"],
  "Trusted contact": visibleDescriptions["Data controls"],
  Reflect: visibleDescriptions.Personalization,
  "Time and focus": visibleDescriptions.Notifications,
  Storage: visibleDescriptions.Billing,
  Keyboard: visibleDescriptions.General,
  Enterprise: visibleDescriptions.General,
  Voice: visibleDescriptions.General,
};

export const settingsNavByName = Object.fromEntries(
  settingsNav.map((item) => [item.name, item]),
) as Record<VisibleSettingsTab, (typeof settingsNav)[number]>;

/** Short labels in the settings rail. Tab ids stay stable for deep links. */
export const settingsNavLabel: Partial<Record<VisibleSettingsTab, string>> = {
  Personalization: "Preferences",
  Capabilities: "Plugins",
  "Security & login": "Security",
  "Clauxen Code": "Code",
};

export function settingsItemLabel(tab: VisibleSettingsTab): string {
  return settingsNavLabel[tab] ?? tab;
}

export const settingsNavGroups: ReadonlyArray<{
  label: string;
  items: readonly VisibleSettingsTab[];
}> = [
  {
    label: "Account",
    items: ["Account", "Personalization", "Notifications"],
  },
  {
    label: "Workspace",
    items: ["General", "Capabilities", "Skills", "Clauxen Code"],
  },
  {
    label: "Data",
    items: ["Data controls", "Security & login", "Billing"],
  },
];

/** Extra search terms so "password" finds Security & login, etc. */
export const settingsNavKeywords: Record<VisibleSettingsTab, string> = {
  General: "theme appearance dark light font language shortcuts keyboard motion contrast",
  Personalization: "tone style instructions memory reflect about you",
  Notifications: "email push alerts quiet hours breaks focus sounds",
  Account: "profile name avatar email organization delete account linked",
  "Security & login": "password passkey mfa 2fa two-step authenticator sessions devices log out",
  "Data controls": "privacy training export history archive delete chats storage cookies safety family parental",
  Billing: "plan subscription invoices payment card upgrade usage",
  Capabilities: "tools memory artifacts canvas web search",
  Skills: "instructions prompts",
  "Clauxen Code": "terminal cli ide developer",
};

const LEGACY_TAB_SET = new Set<string>([
  "Security",
  "Privacy & safety",
  "Privacy",
  "Reflect",
  "Time and focus",
  "Safety",
  "Parental controls",
  "Trusted contact",
  "Storage",
  "Keyboard",
  "Enterprise",
  "Voice",
]);

export function isSettingsTab(value: string): value is SettingsTab {
  return value in settingsNavByName || LEGACY_TAB_SET.has(value);
}

import { CHAT_FONT_OPTIONS } from "@/lib/app-preferences";

/** @deprecated Prefer CHAT_FONT_OPTIONS — kept for any legacy imports. */
export const fontThemes = CHAT_FONT_OPTIONS.map((option) => ({
  name: option.id,
  label: option.label,
  serif: Boolean(
    option.cssVar?.includes("playfair") ||
      option.familyName === "Lora" ||
      option.familyName?.toLowerCase().includes("serif") ||
      option.familyName === "Literata" ||
      option.familyName === "Merriweather" ||
      option.id === "Clauxen Serif",
  ),
  dyslexic: option.id === "Atkinson Hyperlegible",
}));

export { CHAT_FONT_OPTIONS };

export const accentColors = [
  { name: "Blue", value: "#1b67b2" },
  { name: "Forest", value: "#42634f" },
  { name: "Amber", value: "#c88326" },
  { name: "Rose", value: "#b85f75" },
];

export const notificationDeliveryOptions = [
  "Off",
  "Push",
  "Email",
  "Push, Email",
] as const;

export const appearanceOptions = ["System", "Light", "Dark"] as const;

export const contrastOptions = ["System", "Default", "Increased"] as const;

export const motionOptions = ["System", "Reduced"] as const;

export const baseStyleToneOptions = [
  "Default",
  "Professional",
  "Friendly",
  "Candid",
  "Quirky",
  "Efficient",
  "Cynical",
] as const;

/** Rich labels for Base style and tone dropdown. */
export const baseStyleToneOptionItems = [
  { value: "Default", label: "Default", description: "Balanced style" },
  {
    value: "Professional",
    label: "Professional",
    description: "Polished and precise",
  },
  { value: "Friendly", label: "Friendly", description: "Warm and chatty" },
  { value: "Candid", label: "Candid", description: "Direct and encouraging" },
  {
    value: "Quirky",
    label: "Quirky",
    description: "Playful and imaginative",
  },
  { value: "Efficient", label: "Efficient", description: "Concise and plain" },
  {
    value: "Cynical",
    label: "Cynical",
    description: "Critical and sarcastic",
  },
] as const;

export const characteristicLevelOptions = ["More", "Default", "Less"] as const;

export const characteristicWarmOptions = [
  {
    value: "More",
    label: "More",
    description: "Friendlier and more personable",
  },
  { value: "Default", label: "Default" },
  {
    value: "Less",
    label: "Less",
    description: "More professional and factual",
  },
] as const;

export const characteristicEnthusiasticOptions = [
  {
    value: "More",
    label: "More",
    description: "More energy and excitement",
  },
  { value: "Default", label: "Default" },
  {
    value: "Less",
    label: "Less",
    description: "Calmer and more neutral",
  },
] as const;

export const characteristicHeadersListsOptions = [
  {
    value: "More",
    label: "More",
    description: "Use clear formatting and lists",
  },
  { value: "Default", label: "Default" },
  {
    value: "Less",
    label: "Less",
    description: "More paragraphs instead of lists",
  },
] as const;

export const characteristicEmojiOptions = [
  { value: "More", label: "More", description: "Use more emoji" },
  { value: "Default", label: "Default" },
  {
    value: "Less",
    label: "Less",
    description: "Don't use as many emoji",
  },
] as const;

export const personalityOptions = [
  "Default",
  "Friendly",
  "Pragmatic",
  "None",
] as const;

/** @deprecated Personality row removed — base style and tone owns this. */
export const PERSONALITY_SETTING_DEPRECATED = true;
