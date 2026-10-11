import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  Blocks,
  ChartColumn,
  Code2,
  Contact,
  CreditCard,
  Database,
  HardDrive,
  Keyboard,
  LockKeyhole,
  Palette,
  ScrollText,
  Settings2,
  Shield,
  Sparkles,
  UserRound,
  Gauge,
} from "lucide-react";

/** Settings navigation. Older sections remain accepted for existing deep links. */
export const settingsNav = [
  { name: "General", icon: Settings2 },
  { name: "Appearance", icon: Palette },
  { name: "Keyboard", icon: Keyboard },
  { name: "Archived chats", icon: Archive },
  { name: "Storage", icon: HardDrive },
  { name: "Personalization", icon: Sparkles },
  { name: "Usage", icon: Gauge },
  { name: "Analytics", icon: ChartColumn },
  { name: "Notifications", icon: Bell },
  { name: "Parental controls", icon: Shield },
  { name: "Trusted contact", icon: Contact },
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
  | "Enterprise"
  | "Voice";

export type SettingsTab = VisibleSettingsTab | LegacySettingsTab;

/** Map any accepted tab (visible or legacy) to the visible section. */
export function resolveVisibleTab(tab: string): VisibleSettingsTab {
  switch (tab) {
    case "Appearance":
    case "Keyboard":
    case "Archived chats":
    case "General":
    case "Personalization":
    case "Notifications":
    case "Parental controls":
    case "Trusted contact":
    case "Storage":
    case "Usage":
    case "Analytics":
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
      return "Data controls";
    case "Reflect":
      return "Personalization";
    case "Time and focus":
      return "Notifications";
    case "Enterprise":
    case "Voice":
      return "General";
    default:
      return "General";
  }
}

const visibleDescriptions: Record<VisibleSettingsTab, string> = {
  General: "Preferences for your conversations.",
  Appearance: "Theme, fonts, accent color, contrast, and motion.",
  Keyboard: "Customize keyboard shortcuts and restore defaults.",
  "Archived chats": "Chats you have moved out of the sidebar.",
  Storage: "Plan allowance, add-on space, and files kept with your account.",
  Personalization: "How Clauxen responds and what it remembers.",
  Usage: "An overview of your account usage.",
  Analytics: "How this account is using Clauxen.",
  Notifications: "What you hear about, and when to stay quiet.",
  "Parental controls":
    "Limits, quiet hours, and content filters for a linked teen.",
  "Trusted contact":
    "Someone 18 or older we can reach, who can also help recover this account.",
  Account: "Your profile, sign-in security, and devices.",
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
  Reflect: visibleDescriptions.Personalization,
  "Time and focus": visibleDescriptions.Notifications,
  Storage: visibleDescriptions.Storage,
  Billing: visibleDescriptions.Billing,
  Enterprise: visibleDescriptions.General,
  Voice: visibleDescriptions.General,
};

export const settingsNavByName = Object.fromEntries(
  settingsNav.map((item) => [item.name, item]),
) as Record<VisibleSettingsTab, (typeof settingsNav)[number]>;

/** Short labels in the settings rail. Tab ids stay stable for deep links. */
export const settingsNavLabel: Partial<Record<VisibleSettingsTab, string>> = {
  Capabilities: "Tools & capabilities",
  "Security & login": "Security and login",
};

export function settingsItemLabel(tab: VisibleSettingsTab): string {
  return settingsNavLabel[tab] ?? tab;
}

export const settingsNavGroups: ReadonlyArray<{
  label: string;
  items: readonly VisibleSettingsTab[];
}> = [
  {
    label: "Personal",
    items: [
      "General",
      "Appearance",
      "Notifications",
      "Personalization",
      "Account",
      "Security & login",
      "Archived chats",
      "Parental controls",
      "Trusted contact",
      "Storage",
      "Keyboard",
      "Usage",
      "Billing",
      "Data controls",
    ],
  },
  {
    label: "Integrations",
    items: ["Capabilities", "Skills"],
  },
  {
    label: "Coding",
    items: ["Clauxen Code"],
  },
];

/** Extra search terms so "password" finds Security & login, etc. */
export const settingsNavKeywords: Record<VisibleSettingsTab, string> = {
  General: "chat conversations follow-up suggestions",
  Appearance: "theme appearance dark light font accent motion contrast",
  Keyboard: "shortcuts keys keybindings hotkeys",
  "Archived chats": "history archive archived conversations restore",
  Storage: "files images quota disk space addon gigabyte buy extend",
  Personalization: "tone style instructions memory reflect about you",
  Usage: "activity stats overview plan storage invoices",
  Analytics: "activity stats usage overview",
  Notifications: "email push alerts quiet hours breaks focus sounds",
  "Parental controls": "family teen limits quiet hours content filter age",
  "Trusted contact": "recovery emergency contact risk notify",
  Account: "profile name avatar email organization delete account linked",
  "Security & login":
    "password passkey mfa 2fa two-step authenticator sessions devices log out",
  "Data controls":
    "privacy training export history archive delete chats storage cookies safety family parental",
  Billing: "plan subscription invoices payment card upgrade usage",
  Capabilities: "plugins integrations tools memory artifacts canvas web search",
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
