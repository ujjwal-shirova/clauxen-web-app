import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Code2,
  CreditCard,
  KeyRound,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  UserCircle,
} from "lucide-react";

/**
 * Settings IA — 10 sections in 3 groups.
 *
 * Consolidation (was 19 tabs):
 * - General absorbs Keyboard shortcuts.
 * - Personalization absorbs Reflect activity range.
 * - Notifications absorbs Time and focus (breaks + quiet hours).
 * - Account owns profile, org, sessions, and devices.
 * - Security owns sign-in, MFA, passkeys, and advanced protections.
 * - Privacy & safety merges Privacy, Safety, Parental controls, Trusted contact.
 * - Billing absorbs Storage usage.
 * - Skills is the remaining customize surface (connectors/plugins removed).
 * - Clauxen Code stays standalone for developer workflows.
 */
export const settingsNav = [
  { name: "General", icon: Settings },
  { name: "Personalization", icon: Sparkles },
  { name: "Notifications", icon: Bell },
  { name: "Account", icon: UserCircle },
  { name: "Security", icon: KeyRound },
  { name: "Privacy & safety", icon: Shield },
  { name: "Billing", icon: CreditCard },
  { name: "Capabilities", icon: Briefcase },
  { name: "Skills", icon: ScrollText },
  { name: "Clauxen Code", icon: Code2 },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

export type VisibleSettingsTab = (typeof settingsNav)[number]["name"];

/** Removed top-level tabs — still accepted for deep links and old hashes. */
export type LegacySettingsTab =
  | "Security & login"
  | "Security"
  | "Privacy"
  | "Reflect"
  | "Time and focus"
  | "Safety"
  | "Parental controls"
  | "Trusted contact"
  | "Storage"
  | "Keyboard"
  | "Data controls"
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
    case "Security":
    case "Privacy & safety":
    case "Billing":
    case "Capabilities":
    case "Skills":
    case "Clauxen Code":
      return tab;
    case "Security & login":
      return "Security";
    case "Privacy":
    case "Safety":
    case "Parental controls":
    case "Trusted contact":
    case "Data controls":
      return "Privacy & safety";
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

export const settingsTabDescriptions: Record<SettingsTab, string> = {
  General: "Theme, reading, and shortcuts.",
  Personalization: "How Clauxen talks to you and what it remembers.",
  Notifications: "What you hear about, and when to stay quiet.",
  Account: "Profile, organization, sessions, and devices.",
  Security: "Sign-in, two-step verification, and passkeys.",
  "Privacy & safety": "Your data, content safety, and family.",
  Billing: "Plan, usage, invoices, and payment.",
  Capabilities: "Memory, tools, and things Clauxen can do.",
  Skills: "Reusable instructions Clauxen follows.",
  "Clauxen Code": "Terminal and IDE coding sessions.",
  "Security & login": "Sign-in, two-step verification, and passkeys.",
  Privacy: "Your data, content safety, and family.",
  Reflect: "How Clauxen talks to you and what it remembers.",
  "Time and focus": "What you hear about, and when to stay quiet.",
  Safety: "Your data, content safety, and family.",
  "Parental controls": "Your data, content safety, and family.",
  "Trusted contact": "Your data, content safety, and family.",
  Storage: "Plan, usage, invoices, and payment.",
  Keyboard: "Theme, reading, and shortcuts.",
  "Data controls": "Your data, content safety, and family.",
  Enterprise: "Theme, reading, and shortcuts.",
  Voice: "Theme, reading, and shortcuts.",
};

export const settingsNavByName = Object.fromEntries(
  settingsNav.map((item) => [item.name, item]),
) as Record<VisibleSettingsTab, (typeof settingsNav)[number]>;

export const settingsNavGroups: ReadonlyArray<{
  label: string;
  items: readonly VisibleSettingsTab[];
}> = [
  {
    label: "Preferences",
    items: ["General", "Personalization", "Notifications"],
  },
  {
    label: "Account",
    items: ["Account", "Security", "Privacy & safety", "Billing"],
  },
  {
    label: "Workspace",
    items: ["Capabilities", "Skills", "Clauxen Code"],
  },
];

const LEGACY_TAB_SET = new Set<string>([
  "Security & login",
  "Privacy",
  "Reflect",
  "Time and focus",
  "Safety",
  "Parental controls",
  "Trusted contact",
  "Storage",
  "Keyboard",
  "Data controls",
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
