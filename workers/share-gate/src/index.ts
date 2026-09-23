import {
  isAllowedShareHostname,
  isAutomatedShareAgent,
  isShareToken,
  parseShareSnapshot,
  SHARE_ROBOTS_TAG,
  SHARE_TURNSTILE_ACTION,
  TURNSTILE_TEST_SECRET,
  type SharedChatSnapshot,
} from "../../../src/shared/lib/share-public";

export interface Env {
  SHARE_KV: KVNamespace;
  SHARE_WORKER_INTERNAL_TOKEN: string;
  TURNSTILE_SECRET_KEY?: string;
  APP_ORIGIN?: string;
  /** "true" only on a local dev worker. Production must use a real Turnstile secret. */
  ALLOW_TEST_TURNSTILE?: string;
}

const PRIVACY_HEADERS = {
  "x-robots-tag": SHARE_ROBOTS_TAG,
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

function originMatchesRule(origin: string, rule: string): boolean {
  if (rule === origin) return true;
  if (!rule.startsWith("https://*.")) return false;
  try {
    const originUrl = new URL(origin);
    const suffix = rule.slice("https://*.".length);
    return (
      originUrl.protocol === "https:" &&
      originUrl.hostname.endsWith(`.${suffix}`) &&
      originUrl.hostname !== suffix
    );
  } catch {
    return false;
  }
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = (env.APP_ORIGIN ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowOrigin = allowed.some((rule) => originMatchesRule(origin, rule))
    ? origin
    : "";
  if (!allowOrigin) {
    return { vary: "origin" };
  }
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(
  data: unknown,
  status: number,
  extra?: Record<string, string>,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...PRIVACY_HEADERS,
      ...(extra ?? {}),
    },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(buf)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function authorized(request: Request, env: Env): boolean {
  const provided = request.headers.get("x-clauxen-internal") ?? "";
  const expected = env.SHARE_WORKER_INTERNAL_TOKEN ?? "";
  if (!provided || !expected || provided.length !== expected.length) return false;
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  return crypto.subtle.timingSafeEqual(left, right);
}

function kvKey(tokenHash: string) {
  return `share:${tokenHash}`;
}

async function publish(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return json({ error: { message: "Unauthorized." } }, 401);
  }
  const body = (await request.json().catch(() => null)) as {
    tokenHash?: unknown;
    snapshot?: unknown;
  } | null;
  const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash : "";
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) {
    return json({ error: { message: "Invalid share." } }, 400);
  }
  const snapshot = parseShareSnapshot(body?.snapshot);
  if (!snapshot) return json({ error: { message: "Invalid snapshot." } }, 400);
  const encoded = JSON.stringify(snapshot);
  if (encoded.length > 8_000_000) {
    return json({ error: { message: "Snapshot is too large." } }, 413);
  }
  await env.SHARE_KV.put(kvKey(tokenHash), encoded);
  return json({ data: { ok: true } }, 200);
}

async function revoke(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) {
    return json({ error: { message: "Unauthorized." } }, 401);
  }
  const body = (await request.json().catch(() => null)) as {
    tokenHash?: unknown;
  } | null;
  const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash : "";
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) {
    return json({ error: { message: "Invalid share." } }, 400);
  }
  await env.SHARE_KV.delete(kvKey(tokenHash));
  return json({ data: { ok: true } }, 200);
}

function requestHost(request: Request): string {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  ).split(":")[0] ?? "";
}

async function verifyTurnstile(
  env: Env,
  token: string,
  ip: string | null,
  widgetHost: string,
): Promise<string | null> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  const allowTest = env.ALLOW_TEST_TURNSTILE === "true";
  if (!secret || (!allowTest && secret === TURNSTILE_TEST_SECRET)) {
    return "Share links are not configured.";
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  let payload: {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    payload = (await response.json()) as typeof payload;
  } catch {
    return "Could not confirm you are a person. Try again.";
  }
  if (!payload.success) {
    return payload["error-codes"]?.includes("timeout-or-duplicate")
      ? "That check expired. Confirm again, then open the chat."
      : "Confirm you are a person, then try again.";
  }
  if (payload.action && payload.action !== SHARE_TURNSTILE_ACTION) {
    return "Confirm you are a person, then try again.";
  }
  const hostname = payload.hostname?.trim() || widgetHost;
  const extra = (env.APP_ORIGIN ?? "")
    .split(",")
    .map((entry) => {
      try {
        return new URL(entry.trim()).hostname;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const allowed = isAllowedShareHostname(hostname, {
    allowLocal: allowTest,
    extraHosts: extra,
  });
  if (!allowed) return "Confirm you are a person, then try again.";
  return null;
}

async function rateLimit(env: Env, ip: string): Promise<boolean> {
  try {
    const key = `rl:${await sha256Hex(ip)}`;
    const current = Number((await env.SHARE_KV.get(key)) ?? "0");
    const next = Number.isFinite(current) ? current + 1 : 1;
    await env.SHARE_KV.put(key, String(next), { expirationTtl: 600 });
    return next <= 30;
  } catch {
    return true;
  }
}

async function openShare(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(env, request);
  if (!cors["access-control-allow-origin"]) {
    return json({ error: { message: "Origin is not allowed." } }, 403, cors);
  }
  const cf = request.cf as { verifiedBot?: boolean } | undefined;
  if (cf?.verifiedBot || isAutomatedShareAgent(request.headers.get("user-agent"))) {
    return json(
      { error: { message: "This link cannot be opened by an automated client." } },
      403,
      cors,
    );
  }

  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    turnstileToken?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const turnstileToken =
    typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
  if (!isShareToken(token) || !turnstileToken || turnstileToken.length > 2048) {
    return json(
      { error: { message: "Confirm you are a person, then try again." } },
      400,
      cors,
    );
  }

  const ip = request.headers.get("cf-connecting-ip");
  if (ip && !(await rateLimit(env, ip))) {
    return json({ error: { message: "Too many attempts. Try again shortly." } }, 429, cors);
  }

  const widgetHost = request.headers.get("origin")
    ? new URL(request.headers.get("origin") as string).hostname
    : requestHost(request);
  const turnstileError = await verifyTurnstile(env, turnstileToken, ip, widgetHost);
  if (turnstileError) {
    return json({ error: { message: turnstileError } }, 403, cors);
  }

  const stored = await env.SHARE_KV.get(kvKey(await sha256Hex(token)), "json");
  const snapshot: SharedChatSnapshot | null = parseShareSnapshot(stored);
  if (!snapshot) {
    return json({ error: { message: "Share link not found or revoked." } }, 404, cors);
  }
  return json({ data: snapshot }, 200, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/v1/open") {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }
    if (request.method === "POST" && url.pathname === "/internal/publish") {
      return publish(request, env);
    }
    if (request.method === "POST" && url.pathname === "/internal/revoke") {
      return revoke(request, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/open") {
      return openShare(request, env);
    }
    return json({ error: { message: "Not found." } }, 404);
  },
};
