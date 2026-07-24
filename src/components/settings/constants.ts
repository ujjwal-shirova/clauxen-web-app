import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Code2,
  CreditCard,
  Database,
  FileText,
  HardDrive,
  Keyboard,
  KeyRound,
  LayoutGrid,
  Lightbulb,
  Moon,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCircle,
  Users,
  Wand2,
} from "lucide-react";

/**
 * Hybrid Claude + ChatGPT settings IA (no Voice).
 * Conflicts resolved:
 * - Memory generate → Capabilities; memory reference → Personalization
 * - Export / delete / archive → Privacy (no separate Data controls)
 * - Sessions → Account; MFA / sign-in activity → Security
 * - Apps → Connectors only
 * - Notifications → own tab (not duplicated in General)
 */
export const settingsNav = [
  { name: "General", icon: Settings },
  { name: "Personalization", icon: Sparkles },
  { name: "Notifications", icon: Bell },
  { name: "Account", icon: UserCircle },
  { name: "Security", icon: KeyRound },
  { name: "Privacy", icon: Shield },
  { name: "Billing", icon: CreditCard },
  { name: "Storage", icon: HardDrive },
  { name: "Capabilities", icon: Briefcase },
  { name: "Reflect", icon: Lightbulb },
  { name: "Time and focus", icon: Moon },
  { name: "Safety", icon: ShieldAlert },
  { name: "Parental controls", icon: Users },
  { name: "Trusted contact", icon: Database },
  { name: "Clauxen Code", icon: Code2 },
  { name: "Keyboard", icon: Keyboard },
  { name: "Skills", icon: FileText },
  { name: "Connectors", icon: LayoutGrid },
  { name: "Plugins", icon: Wand2 },
] as const satisfies ReadonlyArray<{ name: string; icon: LucideIcon }>;

export type SettingsTab = (typeof settingsNav)[number]["name"];

export const settingsNavByName = Object.fromEntries(
  settingsNav.map((item) => [item.name, item]),
) as Record<SettingsTab, (typeof settingsNav)[number]>;

export const settingsNavGroups: ReadonlyArray<{
  label: string;
  items: readonly SettingsTab[];
}> = [
  {
    label: "Settings",
    items: [
      "General",
      "Personalization",
      "Notifications",
      "Account",
      "Security",
      "Privacy",
      "Billing",
      "Storage",
      "Capabilities",
      "Reflect",
      "Time and focus",
      "Clauxen Code",
      "Keyboard",
    ],
  },
  {
    label: "Customize",
    items: ["Skills", "Connectors", "Plugins"],
  },
  {
    label: "Safety & family",
    items: ["Safety", "Parental controls", "Trusted contact"],
  },
];

export function isSettingsTab(value: string): value is SettingsTab {
  return value in settingsNavByName;
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

/** Rich labels for Base style and tone dropdown (ChatGPT-style). */
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
