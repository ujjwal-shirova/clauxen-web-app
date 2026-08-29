export const COOKIE_CONSENT_STORAGE_KEY = "clauxen.cookie-consent.v1";
export const COOKIE_CONSENT_COOKIE = "clauxen_cookie_consent";
export const COOKIE_VISITOR_COOKIE = "clauxen_vid";
export const COOKIE_ADVERTISING_ID_COOKIE = "clauxen_aid";
export const COOKIE_UTM_COOKIE = "clauxen_utm";

export const COOKIE_CONSENT_EVENT = "clauxen:cookie-consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "clauxen:open-cookie-settings";

export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const COOKIE_UTM_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export const DEFAULT_OPTIONAL_COOKIES = true;

export type CookieConsentSource =
  | "accept_all"
  | "reject_all"
  | "settings"
  | "dismiss";

export type CookieConsentValue = {
  essential: true;
  performance: boolean;
  advertising: boolean;
  updatedAt: string;
};

export type CookieUtmAttribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  gclid: string | null;
  fbclid: string | null;
};

export type CookieEventCategory = "performance" | "advertising";

export const COOKIE_PERFORMANCE_EVENTS = [
  "page_view",
  "web_vital",
] as const;

export const COOKIE_ADVERTISING_EVENTS = [
  "campaign_touch",
  "landing",
] as const;

const VISITOR_ID_PATTERN = /^clx_[a-z0-9]{32}$/i;

export function isConsentValue(value: unknown): value is CookieConsentValue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CookieConsentValue>;
  return (
    candidate.essential === true &&
    typeof candidate.performance === "boolean" &&
    typeof candidate.advertising === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

export function createConsentValue(
  performance: boolean,
  advertising: boolean,
): CookieConsentValue {
  return {
    essential: true,
    performance,
    advertising,
    updatedAt: new Date().toISOString(),
  };
}

export function parseConsentJson(
  raw: string | null | undefined,
): CookieConsentValue | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // Already decoded or malformed.
  }
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isConsentValue(parsed)) return parsed;
    } catch {
      // Try the next encoding.
    }
  }
  return null;
}

export function isValidVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && VISITOR_ID_PATTERN.test(value);
}

export function createVisitorId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000";
  return `clx_${uuid.replace(/-/g, "")}`;
}

export function createAdvertisingId(): string {
  return createVisitorId();
}

export function readNamedCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function parseUtmAttribution(
  search: string | URLSearchParams | null | undefined,
): CookieUtmAttribution | null {
  if (!search) return null;
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;

  const attribution: CookieUtmAttribution = {
    source: emptyToNull(params.get("utm_source")),
    medium: emptyToNull(params.get("utm_medium")),
    campaign: emptyToNull(params.get("utm_campaign")),
    content: emptyToNull(params.get("utm_content")),
    term: emptyToNull(params.get("utm_term")),
    gclid: emptyToNull(params.get("gclid")),
    fbclid: emptyToNull(params.get("fbclid")),
  };

  return Object.values(attribution).some(Boolean) ? attribution : null;
}

export function parseStoredUtm(
  raw: string | null | undefined,
): CookieUtmAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieUtmAttribution>;
    if (!parsed || typeof parsed !== "object") return null;
    const attribution: CookieUtmAttribution = {
      source: emptyToNull(parsed.source),
      medium: emptyToNull(parsed.medium),
      campaign: emptyToNull(parsed.campaign),
      content: emptyToNull(parsed.content),
      term: emptyToNull(parsed.term),
      gclid: emptyToNull(parsed.gclid),
      fbclid: emptyToNull(parsed.fbclid),
    };
    return Object.values(attribution).some(Boolean) ? attribution : null;
  } catch {
    return null;
  }
}

export function isPerformanceEvent(eventType: string): boolean {
  return (COOKIE_PERFORMANCE_EVENTS as readonly string[]).includes(eventType);
}

export function isAdvertisingEvent(eventType: string): boolean {
  return (COOKIE_ADVERTISING_EVENTS as readonly string[]).includes(eventType);
}

export function sanitizeEventPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim().slice(0, 300);
  if (!trimmed.startsWith("/")) return null;
  return trimmed;
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

export function readBrowserConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    const fromStorage = parseConsentJson(stored);
    if (fromStorage) return fromStorage;
  } catch {
    // localStorage can throw in private mode.
  }
  return parseConsentJson(
    readNamedCookie(document.cookie, COOKIE_CONSENT_COOKIE),
  );
}

export function writeBrowserConsent(value: CookieConsentValue) {
  if (typeof window === "undefined") return;
  ensureBrowserVisitorId();
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
  } catch {
    // Cookie persistence remains the fallback.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }),
  );
}

export function writeBrowserUtm(attribution: CookieUtmAttribution | null) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (!attribution) {
    document.cookie = `${COOKIE_UTM_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${COOKIE_UTM_COOKIE}=${encodeURIComponent(JSON.stringify(attribution))}; Path=/; Max-Age=${COOKIE_UTM_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function readBrowserVisitorId(): string | null {
  if (typeof document === "undefined") return null;
  const value = readNamedCookie(document.cookie, COOKIE_VISITOR_COOKIE);
  return isValidVisitorId(value) ? value : null;
}

export function writeBrowserVisitorId(id: string) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_VISITOR_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function ensureBrowserVisitorId(): string {
  const existing = readBrowserVisitorId();
  if (existing) return existing;
  const id = createVisitorId();
  writeBrowserVisitorId(id);
  return id;
}

export function writeBrowserAdvertisingId(id: string | null) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (!id) {
    document.cookie = `${COOKIE_ADVERTISING_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${COOKIE_ADVERTISING_ID_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function readBrowserAdvertisingId(): string | null {
  if (typeof document === "undefined") return null;
  const value = readNamedCookie(document.cookie, COOKIE_ADVERTISING_ID_COOKIE);
  return isValidVisitorId(value) ? value : null;
}

export function readBrowserUtm(): CookieUtmAttribution | null {
  if (typeof document === "undefined") return null;
  return parseStoredUtm(readNamedCookie(document.cookie, COOKIE_UTM_COOKIE));
}

export function applyOptionalBrowserCookies(consent: CookieConsentValue) {
  if (!consent.advertising) {
    writeBrowserAdvertisingId(null);
    writeBrowserUtm(null);
    return;
  }
  if (!readBrowserAdvertisingId()) {
    writeBrowserAdvertisingId(createAdvertisingId());
  }
  if (typeof window !== "undefined") {
    const fromUrl = parseUtmAttribution(window.location.search);
    if (fromUrl) writeBrowserUtm(fromUrl);
  }
}

function emptyToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : null;
}
