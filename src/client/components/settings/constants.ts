import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Cloud,
  Code2,
  CreditCard,
  Database,
  HardDrive,
  Keyboard,
  KeyRound,
  Lightbulb,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCircle,
  Users,
  Wand2,
} from "lucide-react";

/** Voice is deliberately not part of Clauxen's settings surface. */
export const settingsNav = [
  { name: "General", icon: Settings },
  { name: "Notifications", icon: Bell },
  { name: "Personalization", icon: Sparkles },
  { name: "Plugins", icon: Wand2 },
  { name: "Billing", icon: CreditCard },
  { name: "Usage", icon: BarChart3 },
  { name: "Analytics", icon: Lightbulb },
  { name: "Data controls", icon: Database },
  { name: "Cloud browser", icon: Cloud },
  { name: "Storage", icon: HardDrive },
  { name: "Safety", icon: ShieldAlert },
  { name: "Security and login", icon: KeyRound },
  { name: "Parental controls", icon: Users },
  { name: "Trusted contact", icon: Shield },
  { name: "Account", icon: UserCircle },
  { name: "Keyboard", icon: Keyboard },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

/** Deep-link-only destinations which resolve to a visible section. */
export const settingsLegacyNav = [
  { name: "Account & data", icon: UserCircle },
  { name: "Security & safety", icon: KeyRound },
  { name: "Plan & billing", icon: CreditCard },
  { name: "Capabilities & developer", icon: Briefcase },
  { name: "Privacy", icon: Shield },
  { name: "Capabilities", icon: Briefcase },
  { name: "Reflect", icon: Lightbulb },
  { name: "Time and focus", icon: Settings },
  { name: "Clauxen Code", icon: Code2 },
  { name: "Skills", icon: Briefcase },
  { name: "Connectors", icon: Wand2 },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

export type SettingsCategory = (typeof settingsNav)[number]["name"];
export type LegacySettingsTab = (typeof settingsLegacyNav)[number]["name"];
export type SettingsTab = SettingsCategory | LegacySettingsTab;
type SettingsNavItem = { name: SettingsTab; icon: LucideIcon };

export const settingsTabDescriptions: Record<SettingsCategory, string> = {
  General: "Appearance, language, and everyday chat preferences.",
  Notifications: "Choose how Clauxen keeps you up to date.",
  Personalization: "Shape how Clauxen responds and remembers what matters.",
  Plugins: "Manage plugins, connectors, skills, and developer tools.",
  Billing: "Review your plan, invoices, and payment methods.",
  Usage: "Review plan usage and limits.",
  Analytics: "Control reflection and focus preferences.",
  "Data controls": "Manage privacy, history, and how your data is used.",
  "Cloud browser": "Choose how Clauxen can browse and use connected tools.",
  Storage: "Review stored files and workspace content.",
  Safety: "Tune safety preferences for your conversations.",
  "Security and login": "Protect your account and active sessions.",
  "Parental controls": "Set family controls for this account.",
  "Trusted contact": "Choose a trusted contact for account recovery.",
  Account: "Manage your account profile and access.",
  Keyboard: "View and customize keyboard shortcuts.",
};

export const settingsNavByName = Object.fromEntries(
  [...settingsNav, ...settingsLegacyNav].map((item) => [item.name, item]),
) as Record<SettingsTab, SettingsNavItem>;

export const settingsTabAliases: Record<LegacySettingsTab, SettingsCategory> = {
  "Account & data": "Account",
  "Security & safety": "Security and login",
  "Plan & billing": "Billing",
  "Capabilities & developer": "Plugins",
  Privacy: "Data controls",
  Capabilities: "Cloud browser",
  Reflect: "Analytics",
  "Time and focus": "Analytics",
  "Clauxen Code": "Plugins",
  Skills: "Plugins",
  Connectors: "Plugins",
};

export const settingsNavGroups: ReadonlyArray<{
  label: string;
  items: readonly SettingsCategory[];
}> = [{ label: "Settings", items: settingsNav.map((item) => item.name) }];

export function isSettingsTab(value: string): value is SettingsTab {
  return value in settingsNavByName;
}

export function isSettingsCategory(value: string): value is SettingsCategory {
  return settingsNav.some((item) => item.name === value);
}

export function getCanonicalSettingsTab(tab: SettingsTab): SettingsCategory {
  if (isSettingsCategory(tab)) return tab;
  return settingsTabAliases[tab];
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
    option.id === "Default",
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
  { value: "Default", label: "Default", description: "Preset style and tone" },
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
