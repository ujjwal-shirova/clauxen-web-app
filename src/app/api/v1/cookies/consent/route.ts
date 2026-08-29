import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { createConsentValue, createVisitorId } from "@/lib/cookie-consent";
import {
  applyConsentCookies,
  readConsentFromRequest,
  readUtmFromRequest,
  readVisitorIdFromRequest,
  requestCountryCode,
  resolveAdvertisingId,
  resolveVisitorId,
} from "@/server/cookies/http";
import {
  coerceUtm,
  parseConsentSource,
  readStoredConsent,
  saveConsent,
} from "@/server/services/cookie-consent.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(async ({ request, session }) => {
  const existingVisitorId = readVisitorIdFromRequest(request);
  const fromDb = await readStoredConsent({
    visitorId: existingVisitorId,
    userId: session?.id ?? null,
  });
  const fromCookie = readConsentFromRequest(request);
  const consent = fromDb ?? fromCookie;

  const response = jsonData({ consent });
  if (consent) {
    applyConsentCookies(response, request, {
      consent,
      visitorId: existingVisitorId ?? createVisitorId(),
      advertisingId: resolveAdvertisingId(request, consent.advertising),
      utm: consent.advertising ? readUtmFromRequest(request) : null,
    });
  }
  return response;
});

export const PUT = withApiHandler(async ({ request, session }) => {
  const body = (await request.json().catch(() => null)) as {
    performance?: unknown;
    advertising?: unknown;
    source?: unknown;
    utm?: unknown;
  } | null;

  if (
    typeof body?.performance !== "boolean" ||
    typeof body?.advertising !== "boolean"
  ) {
    throw new AppError("Performance and advertising choices are required.");
  }

  const visitorId = resolveVisitorId(request);
  const consent = await saveConsent({
    visitorId,
    userId: session?.id ?? null,
    performance: body.performance,
    advertising: body.advertising,
    source: parseConsentSource(body.source),
    countryCode: requestCountryCode(request),
  });

  const utm = consent.advertising
    ? coerceUtm(body.utm) ?? readUtmFromRequest(request)
    : null;

  const response = jsonData({
    consent: createConsentValue(consent.performance, consent.advertising),
  });
  applyConsentCookies(response, request, {
    consent,
    visitorId,
    advertisingId: resolveAdvertisingId(request, consent.advertising),
    utm,
  });
  return response;
});
