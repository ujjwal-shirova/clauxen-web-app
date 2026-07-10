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
    label: "Safety & family",
    items: ["Safety", "Parental controls", "Trusted contact"],
  },
  {
    label: "Customize",
    items: ["Skills", "Connectors", "Plugins"],
  },
];

export function isSettingsTab(value: string): value is SettingsTab {
  return value in settingsNavByName;
}

export const fontThemes = [
  { name: "Default", serif: true },
  { name: "Sans", serif: false },
  { name: "System", serif: false },
  { name: "Dyslexic friendly", dyslexic: true },
];

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

export const characteristicLevelOptions = ["Less", "Default", "More"] as const;

export const personalityOptions = [
  "Default",
  "Friendly",
  "Pragmatic",
  "None",
] as const;
