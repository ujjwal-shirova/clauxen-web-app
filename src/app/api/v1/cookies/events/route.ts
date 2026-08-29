import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { AppError } from "@/server/db/errors";
import { assertRateLimit } from "@/server/http/rate-limit";
import {
  applyVisitorCookie,
  readConsentFromRequest,
  readUtmFromRequest,
  readVisitorIdFromRequest,
  requestCountryCode,
  resolveVisitorId,
} from "@/server/cookies/http";
import type { CookieEventCategory } from "@/lib/cookie-consent";
import {
  coerceUtm,
  readStoredConsent,
  recordConsentedEvent,
} from "@/server/services/cookie-consent.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, session }) => {
  const existingVisitorId = readVisitorIdFromRequest(request);
  const visitorId = existingVisitorId ?? resolveVisitorId(request);
  assertRateLimit({
    key: `cookie-events:${visitorId}`,
    limit: 40,
    windowMs: 60_000,
    message: "Too many analytics events.",
  });

  const body = (await request.json().catch(() => null)) as {
    category?: unknown;
    eventType?: unknown;
    path?: unknown;
    referrer?: unknown;
    utm?: unknown;
    payload?: unknown;
  } | null;

  const category = body?.category;
  const eventType =
    typeof body?.eventType === "string" ? body.eventType.trim() : "";
  if (
    (category !== "performance" && category !== "advertising") ||
    !eventType
  ) {
    throw new AppError("A valid cookie event is required.");
  }

  const fromDb = await readStoredConsent({
    visitorId,
    userId: session?.id ?? null,
  });
  const consent = fromDb ?? readConsentFromRequest(request);
  if (!consent) {
    throw new AppError("Cookie consent is required.", 403, "consent_required");
  }

  await recordConsentedEvent({
    visitorId,
    userId: session?.id ?? null,
    consent,
    category: category as CookieEventCategory,
    eventType,
    path: typeof body?.path === "string" ? body.path : null,
    referrer: typeof body?.referrer === "string" ? body.referrer : null,
    utm: coerceUtm(body?.utm) ?? readUtmFromRequest(request),
    countryCode: requestCountryCode(request),
    payload:
      body?.payload && typeof body.payload === "object"
        ? (body.payload as Record<string, unknown>)
        : undefined,
  });

  const response = jsonData({ ok: true as const });
  if (!existingVisitorId) {
    applyVisitorCookie(response, request, visitorId);
  }
  return response;
});
