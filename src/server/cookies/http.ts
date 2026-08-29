import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import {
  COOKIE_ADVERTISING_ID_COOKIE,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_UTM_COOKIE,
  COOKIE_UTM_MAX_AGE_SECONDS,
  COOKIE_VISITOR_COOKIE,
  createAdvertisingId,
  createVisitorId,
  isValidVisitorId,
  parseConsentJson,
  parseStoredUtm,
  type CookieConsentValue,
  type CookieUtmAttribution,
} from "@/lib/cookie-consent";
import { env } from "@/server/config/env";

function cookieBase(request: NextRequest) {
  const secure =
    request.nextUrl.protocol === "https:" || env.isVercel;
  return {
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

export function readConsentFromRequest(
  request: NextRequest,
): CookieConsentValue | null {
  return parseConsentJson(request.cookies.get(COOKIE_CONSENT_COOKIE)?.value);
}

export function readVisitorIdFromRequest(request: NextRequest): string | null {
  const value = request.cookies.get(COOKIE_VISITOR_COOKIE)?.value ?? null;
  return isValidVisitorId(value) ? value : null;
}

export function readAdvertisingIdFromRequest(
  request: NextRequest,
): string | null {
  const value = request.cookies.get(COOKIE_ADVERTISING_ID_COOKIE)?.value ?? null;
  return isValidVisitorId(value) ? value : null;
}

export function readUtmFromRequest(
  request: NextRequest,
): CookieUtmAttribution | null {
  return parseStoredUtm(request.cookies.get(COOKIE_UTM_COOKIE)?.value);
}

export function requestCountryCode(request: NextRequest): string | null {
  const raw =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");
  const code = raw?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function applyConsentCookies(
  response: NextResponse,
  request: NextRequest,
  input: {
    consent: CookieConsentValue;
    visitorId: string;
    advertisingId: string | null;
    utm: CookieUtmAttribution | null;
  },
) {
  const base = cookieBase(request);

  response.cookies.set(COOKIE_CONSENT_COOKIE, JSON.stringify(input.consent), {
    ...base,
    httpOnly: false,
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
  });
  response.cookies.set(COOKIE_VISITOR_COOKIE, input.visitorId, {
    ...base,
    httpOnly: false,
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
  });

  if (input.consent.advertising && input.advertisingId) {
    response.cookies.set(COOKIE_ADVERTISING_ID_COOKIE, input.advertisingId, {
      ...base,
      httpOnly: false,
      maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
    });
  } else {
    response.cookies.set(COOKIE_ADVERTISING_ID_COOKIE, "", {
      ...base,
      httpOnly: false,
      maxAge: 0,
    });
  }

  if (input.consent.advertising && input.utm) {
    response.cookies.set(COOKIE_UTM_COOKIE, JSON.stringify(input.utm), {
      ...base,
      httpOnly: false,
      maxAge: COOKIE_UTM_MAX_AGE_SECONDS,
    });
  } else if (!input.consent.advertising) {
    response.cookies.set(COOKIE_UTM_COOKIE, "", {
      ...base,
      httpOnly: false,
      maxAge: 0,
    });
  }
}

export function applyVisitorCookie(
  response: NextResponse,
  request: NextRequest,
  visitorId: string,
) {
  response.cookies.set(COOKIE_VISITOR_COOKIE, visitorId, {
    ...cookieBase(request),
    httpOnly: false,
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
  });
}

export function resolveVisitorId(request: NextRequest): string {
  return readVisitorIdFromRequest(request) ?? createVisitorId();
}

export function resolveAdvertisingId(
  request: NextRequest,
  advertising: boolean,
): string | null {
  if (!advertising) return null;
  return readAdvertisingIdFromRequest(request) ?? createAdvertisingId();
}
