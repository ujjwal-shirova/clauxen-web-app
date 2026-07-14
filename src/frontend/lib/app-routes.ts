/**
 * Canonical app routes.
 *
 * Main pages (real Next routes): `/`, `/new`, `/c/:id`, `/library`, `/projects`, …
 * Sub-pages / overlays (hash fragments, ChatGPT-style): `#settings`, `#settings/Personalization`,
 * `#pricing`, `#gift`, `#apps` — parent page stays loaded underneath.
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
  const fromSlug = decoded
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  return tab.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Main (parent) page paths — never use these for overlays. */
export const APP_ROUTES = {
  root: "/",
  newChat: "/new",
  home: "/new",
  library: "/library",
  projects: "/projects",
  customize: "/customize",
  chat: (chatId: string) => `/c/${encodeURIComponent(chatId)}`,
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  projectConversation: (projectId: string, chatId: string) =>
    `/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(chatId)}`,
  /** @deprecated Prefer overlay hash helpers — kept for legacy path redirects. */
  upgrade: "/upgrade",
  pricing: "/upgrade",
  gift: "/gift",
  apps: "/apps",
  settings: (tab: SettingsTab | string = "General") =>
    `/settings/${settingsTabToSlug(
      isSettingsTab(tab) ? tab : normalizeSettingsTab(String(tab)),
    )}`,
} as const;

export type AppOverlayPath =
  | { type: "pricing" }
  | { type: "apps" }
  | { type: "gift" }
  | { type: "settings"; tab: SettingsTab };

/** Parse hash fragment into an overlay (ChatGPT-style). */
export function parseOverlayHash(
  hash: string | null | undefined,
): AppOverlayPath | null {
  if (!hash) return null;
  const clean = hash.replace(/^#/, "").split(/[?#]/)[0] ?? "";
  if (!clean) return null;

  if (clean === "pricing" || clean === "upgrade") {
    return { type: "pricing" };
  }
  if (clean === "apps") return { type: "apps" };
  if (clean === "gift") return { type: "gift" };

  if (clean === "settings" || clean.startsWith("settings/")) {
    const parts = clean.split("/");
    const raw = parts[1] ? decodeURIComponent(parts.slice(1).join("/")) : "General";
    return { type: "settings", tab: normalizeSettingsTab(raw) };
  }

  return null;
}

/** Hash fragment for an overlay (includes leading `#`). */
export function overlayToHash(overlay: AppOverlayPath): string {
  switch (overlay.type) {
    case "pricing":
      return "#pricing";
    case "apps":
      return "#apps";
    case "gift":
      return "#gift";
    case "settings":
      return overlay.tab === "General"
        ? "#settings"
        : `#settings/${encodeURIComponent(overlay.tab)}`;
    default:
      return "";
  }
}

/**
 * Legacy path overlays (`/settings/general`, `/upgrade`, …).
 * Used only to migrate old bookmarks → hash on the parent page.
 */
export function parseOverlayPath(
  pathname: string | null,
): AppOverlayPath | null {
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

/** @deprecated Use overlayToHash — path overlays are no longer primary. */
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

/** True when pathname is a real main surface (not a legacy overlay path). */
export function isMainAppPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (parseOverlayPath(pathname)) return false;
  return (
    pathname === "/" ||
    pathname === "/new" ||
    pathname.startsWith("/c/") ||
    pathname === "/library" ||
    pathname.startsWith("/library/") ||
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/customize" ||
    pathname.startsWith("/customize/")
  );
}

/**
 * Build parent URL + overlay hash. Defaults parent to `/new` when current
 * location is a legacy overlay path (so refresh never lands on a blank page).
 */
export function buildOverlayLocation(
  overlay: AppOverlayPath,
  parentPathname?: string | null,
  parentSearch?: string,
): string {
  const hash = overlayToHash(overlay);
  let path = parentPathname || APP_ROUTES.newChat;
  if (!isMainAppPath(path)) {
    path = APP_ROUTES.newChat;
  }
  const search = parentSearch ?? "";
  return `${path}${search}${hash}`;
}

/** @deprecated Prefer parseOverlayHash — kept for auth redirect helpers. */
export function legacyHashToPath(hash: string): string | null {
  const overlay = parseOverlayHash(hash);
  if (!overlay) return null;
  return overlayToPath(overlay);
}
