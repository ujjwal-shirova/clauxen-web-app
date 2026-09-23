import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import {
  isAllowedShareHostname,
  SHARE_TURNSTILE_ACTION,
  TURNSTILE_TEST_SECRET,
  TURNSTILE_TEST_SITE_KEY,
} from "@/lib/share-public";

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function resolveTurnstileKeys(): { siteKey: string; secret: string } | null {
  const siteKey = env.turnstileSiteKey;
  const secret = env.turnstileSecretKey;
  if (siteKey && secret) {
    if (env.isProduction && secret === TURNSTILE_TEST_SECRET) return null;
    return { siteKey, secret };
  }
  if (env.isProduction) return null;
  return { siteKey: TURNSTILE_TEST_SITE_KEY, secret: TURNSTILE_TEST_SECRET };
}

export function clientIpFromRequest(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

export async function verifyShareTurnstile(input: {
  token: string;
  ip: string | null;
  requestHost: string;
}): Promise<void> {
  const keys = resolveTurnstileKeys();
  if (!keys) {
    throw new AppError(
      "Share links are not configured.",
      503,
      "share_unconfigured",
    );
  }

  const token = input.token.trim();
  if (!token || token.length > 2048) {
    throw new AppError("Confirm you are a person, then try again.", 400, "turnstile_required");
  }

  const body = new URLSearchParams();
  body.set("secret", keys.secret);
  body.set("response", token);
  if (input.ip) body.set("remoteip", input.ip);

  let payload: SiteverifyResponse;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    throw new AppError(
      "Could not confirm you are a person. Try again.",
      503,
      "turnstile_unavailable",
    );
  }

  if (!payload.success) {
    const duplicate = payload["error-codes"]?.includes("timeout-or-duplicate");
    throw new AppError(
      duplicate
        ? "That check expired. Confirm again, then open the chat."
        : "Confirm you are a person, then try again.",
      403,
      "turnstile_failed",
    );
  }

  if (keys.secret === TURNSTILE_TEST_SECRET) {
    if (env.isProduction) {
      throw new AppError("Share links are not configured.", 503, "share_unconfigured");
    }
    return;
  }

  if (payload.action && payload.action !== SHARE_TURNSTILE_ACTION) {
    throw new AppError("Confirm you are a person, then try again.", 403, "turnstile_failed");
  }

  const hostname = payload.hostname?.trim() || input.requestHost;
  const requestHost = input.requestHost.split(":")[0] ?? "";
  const allowed =
    isAllowedShareHostname(hostname, {
      allowLocal: !env.isProduction,
      extraHosts: [requestHost],
    }) &&
    isAllowedShareHostname(requestHost, {
      allowLocal: !env.isProduction,
    });
  if (!allowed) {
    throw new AppError("Confirm you are a person, then try again.", 403, "turnstile_failed");
  }
}
