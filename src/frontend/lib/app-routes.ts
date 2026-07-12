/**
 * Canonical app routes — shareable paths for chat shell surfaces.
 * Prefer these over hash fragments (#pricing) to avoid hydration / router races.
 */

import {
  isSettingsTab,
  type SettingsTab,
} from "@/frontend/components/settings/constants";

const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  Enterprise: "General",
  "Data controls": "Privacy",
  Apps: "Connectors",
  Voice: "General",
};

export function normalizeSettingsTab(value: string): SettingsTab {
  const decoded = decodeURIComponent(value).trim();
  if (isSettingsTab(decoded)) return decoded;
  // slug form: personalization, time-and-focus
  const fromSlug = decoded
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  // Fix known multi-word tabs after naive title-case
  const slugMap: Record<string, SettingsTab> = {
    general: "General",
    personalization: "Personalization",
    notifications: "Notifications",
    account: "Account",
    security: "Security",
    privacy: "Privacy",
    billing: "Billing",
    storage: "Storage",
    capabilities: "Capabilities",
    reflect: "Reflect",
    "time-and-focus": "Time and focus",
    "time and focus": "Time and focus",
    safety: "Safety",
    "parental-controls": "Parental controls",
    "parental controls": "Parental controls",
    "trusted-contact": "Trusted contact",
    "trusted contact": "Trusted contact",
    "clauxen-code": "Clauxen Code",
    "clauxen code": "Clauxen Code",
    keyboard: "Keyboard",
    skills: "Skills",
    connectors: "Connectors",
    plugins: "Plugins",
  };
  const lower = decoded.toLowerCase();
  if (slugMap[lower]) return slugMap[lower];
  if (isSettingsTab(fromSlug)) return fromSlug;
  return LEGACY_SETTINGS_TABS[decoded] ?? "General";
}

export function settingsTabToSlug(tab: SettingsTab): string {
  return tab
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export const APP_ROUTES = {
  newChat: "/new",
  home: "/new",
  upgrade: "/upgrade",
  pricing: "/upgrade",
  gift: "/gift",
  apps: "/apps",
  library: "/library",
  projects: "/projects",
  customize: "/customize",
  settings: (tab: SettingsTab | string = "General") =>
    `/settings/${settingsTabToSlug(
      isSettingsTab(tab) ? tab : normalizeSettingsTab(String(tab)),
    )}`,
  chat: (chatId: string) => `/c/${encodeURIComponent(chatId)}`,
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  projectConversation: (projectId: string, chatId: string) =>
    `/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(chatId)}`,
} as const;

export type AppOverlayPath =
  | { type: "pricing" }
  | { type: "apps" }
  | { type: "gift" }
  | { type: "settings"; tab: SettingsTab };

/** Parse pathname into an overlay surface (null = chat / other main content). */
export function parseOverlayPath(pathname: string | null): AppOverlayPath | null {
  if (!pathname) return null;
  if (pathname === "/upgrade" || pathname === "/pricing") {
    return { type: "pricing" };
  }
  if (pathname === "/gift") return { type: "gift" };
  if (pathname === "/apps") return { type: "apps" };
  const settingsMatch = pathname.match(/^\/settings(?:\/([^/]+))?\/?$/);
  if (settingsMatch) {
    return {
      type: "settings",
      tab: normalizeSettingsTab(settingsMatch[1] || "general"),
    };
  }
  return null;
}

export function overlayToPath(overlay: AppOverlayPath): string {
  switch (overlay.type) {
    case "pricing":
      return APP_ROUTES.upgrade;
    case "apps":
      return APP_ROUTES.apps;
    case "gift":
      return APP_ROUTES.gift;
    case "settings":
      return APP_ROUTES.settings(overlay.tab);
    default:
      return APP_ROUTES.newChat;
  }
}

/** True when this path is a blank new-chat surface. */
export function isNewChatPath(pathname: string | null): boolean {
  return pathname === "/new" || pathname === "/" || pathname === "";
}

/**
 * Map legacy hash overlays (#pricing, #settings/General) → path.
 * Returns null when hash is not an overlay fragment.
 */
export function legacyHashToPath(hash: string): string | null {
  if (!hash) return null;
  const clean = hash.replace(/^#/, "").split("#")[0] ?? "";
  if (!clean) return null;
  if (clean === "pricing") return APP_ROUTES.upgrade;
  if (clean === "apps") return APP_ROUTES.apps;
  if (clean === "gift") return APP_ROUTES.gift;
  if (clean.startsWith("settings")) {
    const parts = clean.split("/");
    const raw = parts[1] ? decodeURIComponent(parts[1]) : "General";
    return APP_ROUTES.settings(normalizeSettingsTab(raw));
  }
  return null;
}
