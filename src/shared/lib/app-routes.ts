/**
 * Canonical app routes.
 *
 * Main pages (real Next routes): `/`, `/new`, `/c/:id`, `/library`, …
 * Sub-pages / overlays (hash fragments): `#settings`, `#settings/Personalization`,
 * `#pricing`, `#gift` — parent page stays loaded underneath.
 */

import {
  isSettingsTab,
  type SettingsTab,
} from "@/components/settings/constants";

const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  Enterprise: "General",
  Voice: "General",
  Security: "Security & login",
  "Privacy & safety": "Data controls",
  Privacy: "Data controls",
  Reflect: "Personalization",
  "Time and focus": "Notifications",
  Safety: "Data controls",
  "Parental controls": "Data controls",
  "Trusted contact": "Data controls",
  Storage: "Billing",
  Keyboard: "General",
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
    security: "Security & login",
    "security-and-login": "Security & login",
    "security-&-login": "Security & login",
    "security and login": "Security & login",
    "security & login": "Security & login",
    privacy: "Data controls",
    "privacy-and-safety": "Data controls",
    "privacy-&-safety": "Data controls",
    "privacy and safety": "Data controls",
    "privacy & safety": "Data controls",
    billing: "Billing",
    storage: "Billing",
    capabilities: "Capabilities",
    reflect: "Personalization",
    "time-and-focus": "Notifications",
    "time and focus": "Notifications",
    safety: "Data controls",
    "parental-controls": "Data controls",
    "parental controls": "Data controls",
    "trusted-contact": "Data controls",
    "trusted contact": "Data controls",
    "clauxen-code": "Clauxen Code",
    "clauxen code": "Clauxen Code",
    keyboard: "General",
    skills: "Skills",
    "data-controls": "Data controls",
    "data controls": "Data controls",
    enterprise: "General",
    voice: "General",
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
  /** @deprecated Removed — Customize nav opens settings Skills. Kept for redirects. */
  customize: "/customize",
  myClauxen: "/my-clauxen",

  chat: (chatId: string) => `/c/${encodeURIComponent(chatId)}`,
  /** @deprecated Prefer overlay hash helpers — kept for legacy path redirects. */
  upgrade: "/upgrade",
  pricing: "/upgrade",
  gift: "/gift",
  settings: (tab: SettingsTab | string = "General") =>
    `/settings/${settingsTabToSlug(
      isSettingsTab(tab) ? tab : normalizeSettingsTab(String(tab)),
    )}`,
} as const;

/** Chat thread surfaces — `/`, `/new`, `/c/:id`, incognito. */
export function isChatSurfacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (isNewChatPath(pathname) || isIncognitoPath(pathname)) return true;
  if (pathname.startsWith("/c/")) return true;
  return false;
}

export type AppOverlayPath =
  | { type: "pricing" }
  | { type: "gift" }
  | { type: "settings"; tab: SettingsTab };

/** Parse hash fragment into an overlay. */
export function parseOverlayHash(
  hash: string | null | undefined,
): AppOverlayPath | null {
  if (!hash) return null;
  const clean = hash.replace(/^#/, "").split(/[?#]/)[0] ?? "";
  if (!clean) return null;

  if (clean === "pricing" || clean === "upgrade") {
    return { type: "pricing" };
  }
  if (clean === "gift") return { type: "gift" };

  if (clean === "settings" || clean.startsWith("settings/")) {
    const parts = clean.split("/");
    const raw = parts[1]
      ? decodeURIComponent(parts.slice(1).join("/"))
      : "General";
    return { type: "settings", tab: normalizeSettingsTab(raw) };
  }

  return null;
}

/** Hash fragment for an overlay (includes leading `#`). */
export function overlayToHash(overlay: AppOverlayPath): string {
  switch (overlay.type) {
    case "pricing":
      return "#pricing";
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

/** True when this path is the Incognito (ephemeral) chat surface. */
export function isIncognitoPath(pathname: string | null): boolean {
  return (
    pathname === "/incognito" || pathname?.startsWith("/incognito/") === true
  );
}

/** Local session ids for Incognito — never hit Postgres chat rows. */
export function isIncognitoSessionId(
  chatId: string | null | undefined,
): boolean {
  return Boolean(chatId && chatId.startsWith("incognito-"));
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
    pathname === "/scheduled" ||
    pathname.startsWith("/scheduled/") ||
    pathname === "/my-clauxen" ||
    pathname.startsWith("/my-clauxen/")
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
