import { AppError } from "@/server/db/errors";
import {
  createConsentValue,
  isAdvertisingEvent,
  isPerformanceEvent,
  parseStoredUtm,
  sanitizeEventPath,
  type CookieConsentSource,
  type CookieConsentValue,
  type CookieEventCategory,
  type CookieUtmAttribution,
} from "@/lib/cookie-consent";
import * as cookieRepo from "@/server/repositories/cookie-consent.repository";

const CONSENT_SOURCES = new Set<CookieConsentSource>([
  "accept_all",
  "reject_all",
  "settings",
  "dismiss",
]);

function isUnavailableStore(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  return (
    error.code === "database_error" ||
    error.code === "database_unavailable" ||
    error.code === "database_busy"
  );
}

export function parseConsentSource(value: unknown): CookieConsentSource {
  if (
    typeof value === "string" &&
    CONSENT_SOURCES.has(value as CookieConsentSource)
  ) {
    return value as CookieConsentSource;
  }
  return "settings";
}

export function rowToConsent(row: {
  performance: boolean;
  advertising: boolean;
  updated_at: string;
}): CookieConsentValue {
  return {
    essential: true,
    performance: row.performance,
    advertising: row.advertising,
    updatedAt: row.updated_at,
  };
}

export async function readStoredConsent(input: {
  visitorId: string | null;
  userId: string | null;
}): Promise<CookieConsentValue | null> {
  try {
    if (input.userId) {
      const byUser = await cookieRepo.getLatestConsentByUserId(input.userId);
      if (byUser) return rowToConsent(byUser);
    }
    if (input.visitorId) {
      const byVisitor = await cookieRepo.getConsentByVisitorId(input.visitorId);
      if (byVisitor) return rowToConsent(byVisitor);
    }
  } catch (error) {
    if (isUnavailableStore(error)) return null;
    throw error;
  }
  return null;
}

export async function saveConsent(input: {
  visitorId: string;
  userId?: string | null;
  performance: boolean;
  advertising: boolean;
  source: CookieConsentSource;
  countryCode?: string | null;
}): Promise<CookieConsentValue> {
  const row = await cookieRepo.saveConsent({
    visitorId: input.visitorId,
    userId: input.userId,
    performance: input.performance,
    advertising: input.advertising,
    source: input.source,
    countryCode: input.countryCode,
  });
  return row
    ? rowToConsent(row)
    : createConsentValue(input.performance, input.advertising);
}

export async function recordConsentedEvent(input: {
  visitorId: string;
  userId?: string | null;
  consent: CookieConsentValue;
  category: CookieEventCategory;
  eventType: string;
  path?: string | null;
  referrer?: string | null;
  utm?: CookieUtmAttribution | null;
  countryCode?: string | null;
  payload?: Record<string, unknown>;
}) {
  if (input.category === "performance") {
    if (!input.consent.performance || !isPerformanceEvent(input.eventType)) {
      throw new AppError(
        "Performance cookies are not allowed.",
        403,
        "consent_denied",
      );
    }
  } else if (
    !input.consent.advertising ||
    !isAdvertisingEvent(input.eventType)
  ) {
    throw new AppError(
      "Advertising cookies are not allowed.",
      403,
      "consent_denied",
    );
  }

  const path = sanitizeEventPath(input.path);
  const referrer =
    typeof input.referrer === "string"
      ? input.referrer.trim().slice(0, 300) || null
      : null;

  await cookieRepo.insertEvent({
    visitorId: input.visitorId,
    userId: input.userId,
    category: input.category,
    eventType: input.eventType,
    path,
    referrer,
    utmSource: input.utm?.source ?? null,
    utmMedium: input.utm?.medium ?? null,
    utmCampaign: input.utm?.campaign ?? null,
    countryCode: input.countryCode ?? null,
    payload: sanitizePayload(input.payload),
  });
}

export async function purgeCookieDataForUser(userId: string) {
  await cookieRepo.deleteAllForUser(userId);
}

export function coerceUtm(value: unknown): CookieUtmAttribution | null {
  if (!value || typeof value !== "object") return null;
  return parseStoredUtm(JSON.stringify(value));
}

function sanitizePayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) return {};
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > 2048) return {};
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
