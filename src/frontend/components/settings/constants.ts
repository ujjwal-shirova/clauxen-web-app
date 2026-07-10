import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Code2,
  CreditCard,
  FileText,
  LayoutGrid,
  Lightbulb,
  Moon,
  Settings,
  Shield,
  UserCircle,
  Wand2,
} from "lucide-react";

export const settingsNav = [
  { name: "General", icon: Settings },
  { name: "Account", icon: UserCircle },
  { name: "Privacy", icon: Shield },
  { name: "Billing", icon: CreditCard },
  { name: "Capabilities", icon: Briefcase },
  { name: "Reflect", icon: Lightbulb },
  { name: "Time and focus", icon: Moon },
  { name: "Clauxen Code", icon: Code2 },
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
      "Account",
      "Privacy",
      "Billing",
      "Capabilities",
      "Reflect",
      "Time and focus",
      "Clauxen Code",
    ],
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

export const voiceOptions = ["Ember", "Lumen", "Cedar", "Sol"];

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
