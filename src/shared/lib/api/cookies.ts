import { apiFetch } from "@/lib/api/client";
import type {
  CookieConsentSource,
  CookieConsentValue,
  CookieEventCategory,
  CookieUtmAttribution,
} from "@/lib/cookie-consent";

export type CookieConsentResponse = {
  consent: CookieConsentValue | null;
};

export async function getCookieConsent() {
  return apiFetch<CookieConsentResponse>("/api/v1/cookies/consent");
}

export async function saveCookieConsent(input: {
  performance: boolean;
  advertising: boolean;
  source: CookieConsentSource;
  utm?: CookieUtmAttribution | null;
}) {
  return apiFetch<CookieConsentResponse>("/api/v1/cookies/consent", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function recordCookieEvent(input: {
  category: CookieEventCategory;
  eventType: string;
  path?: string;
  referrer?: string | null;
  utm?: CookieUtmAttribution | null;
  payload?: Record<string, unknown>;
}) {
  return apiFetch<{ ok: true }>("/api/v1/cookies/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
