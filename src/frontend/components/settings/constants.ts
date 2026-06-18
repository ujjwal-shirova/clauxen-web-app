import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Clock,
  CreditCard,
  Database,
  HardDrive,
  History,
  Keyboard,
  KeyRound,
  LayoutGrid,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";

export const settingsNav = [
  { name: "General", icon: Settings },
  { name: "Notifications", icon: Bell },
  { name: "Personalization", icon: History },
  { name: "Apps", icon: LayoutGrid },
  { name: "Schedules", icon: Clock },
  { name: "Billing", icon: CreditCard },
  { name: "Data controls", icon: Database },
  { name: "Storage", icon: HardDrive },
  { name: "Security", icon: KeyRound },
  { name: "Parental controls", icon: Users },
  { name: "Trusted contact", icon: ShieldCheck },
  { name: "Account", icon: UserCircle },
  { name: "Keyboard", icon: Keyboard },
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
    label: "Preferences",
    items: [
      "General",
      "Notifications",
      "Personalization",
      "Apps",
      "Schedules",
    ],
  },
  {
    label: "Plan & data",
    items: ["Billing", "Data controls", "Storage"],
  },
  {
    label: "Privacy & account",
    items: [
      "Security",
      "Parental controls",
      "Trusted contact",
      "Account",
    ],
  },
  {
    label: "Shortcuts",
    items: ["Keyboard"],
  },
];

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
