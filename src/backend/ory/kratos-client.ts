// session whoami, identity CRUD, webhook parse/verify — server-side identity layer
// =============================================================================

import { timingSafeEqual } from "crypto";
import { env } from "@/backend/config/env"; // Kratos public/admin URLs, webhook secret
import { AppError } from "@/backend/db/errors"; // typed errors — 401/400/502/503 with codes

const KRATOS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_LIST_IDENTITIES_PER_PAGE = 250;

function assertKratosIdentityId(identityId: string): void {
  if (!KRATOS_ID_RE.test(identityId)) {
    throw new AppError("Invalid identity id.", 400, "bad_request");
  }
}

function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type KratosIdentityTraits = {
  email?: string;
  name?: { first?: string; last?: string };
};

export type KratosIdentity = {
  id: string; // UUID — primary key across Ory stack
  schema_id?: string; // identity schema version reference
  state?: string; // active/inactive lifecycle
  traits: KratosIdentityTraits; // user-facing profile fields
  created_at?: string;
  updated_at?: string;
};

// browser session object — whoami endpoint response shape
export type KratosSession = {
  id: string;
  active?: boolean; // false = expired/revoked session
  identity?: KratosIdentity; // nested identity when session valid
  expires_at?: string;
};

// internal fetch options — admin vs public base URL, cookie forwarding, JSON body
type KratosRequestOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  admin?: boolean;
};

// Kratos base URL resolve — admin port (4434) vs public port (4433)
function kratosBaseUrl(admin = false): string {
  const url = admin ? env.oryKratosAdminUrl : env.oryKratosPublicUrl;
  if (!url) {
    throw new AppError("Kratos is not configured.", 503, "kratos_unavailable");
  }
  return url.replace(/\/$/, ""); // trailing slash normalize
}

// generic Kratos HTTP helper — error mapping, 204 handling, JSON parse
async function kratosRequest<T>(
  path: string,
  options: KratosRequestOptions = {},
): Promise<T> {
  if (!path.startsWith("/") || path.includes("..")) {
    throw new AppError("Invalid Kratos request path.", 500, "internal_error");
  }
  const base = kratosBaseUrl(options.admin); // admin=true → identity management APIs
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.cookie) {
    // browser session cookie forward — whoami-style public endpoints
    headers.Cookie = options.cookie;
  }

  if (options.body !== undefined) {
    // POST/PATCH with JSON payload
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"), // default method inference
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AppError(
      `Kratos request failed (${response.status}).`,
      response.status === 401 ? 401 : 502, // 401 pass-through — invalid session; else gateway error
      "kratos_error",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T; // typed JSON response
}

export function displayNameFromTraits(
  traits: KratosIdentityTraits,
): string | null {
  const first = traits.name?.first?.trim() ?? "";
  const last = traits.name?.last?.trim() ?? "";
  const combined = `${first} ${last}`.trim(); // full name string
  if (combined) return combined;
  return traits.email?.trim() || null; // no name — email as display fallback
}

export async function getSessionWhoami(
  cookieHeader: string,
): Promise<KratosSession | null> {
  if (!env.oryKratosPublicUrl || !cookieHeader) return null;

  const response = await fetch(`${kratosBaseUrl()}/sessions/whoami`, {
    headers: { cookie: cookieHeader, Accept: "application/json" }, // session cookie as-is forward
    cache: "no-store",
  });

  if (!response.ok) return null; // expired/invalid session — caller treats as logged out
  return (await response.json()) as KratosSession; // active session + optional identity
}

// admin API — single identity by UUID fetch
export async function getIdentityById(
  identityId: string,
): Promise<KratosIdentity> {
  return kratosRequest<KratosIdentity>(`/admin/identities/${identityId}`, {
    admin: true,
  });
}

// admin API — paginated identity list (SCIM/sync workflows)
export async function listIdentities(params?: {
  pageToken?: string;
  perPage?: number;
}): Promise<KratosIdentity[]> {
  const search = new URLSearchParams();
  if (params?.pageToken) search.set("page_token", params.pageToken); // cursor pagination
  if (params?.perPage) {
    const perPage = Math.min(
      Math.max(1, Math.floor(params.perPage)),
      MAX_LIST_IDENTITIES_PER_PAGE,
    );
    search.set("per_page", String(perPage)); // page size limit — capped to avoid admin API abuse
  }
  const query = search.toString();
  return kratosRequest<KratosIdentity[]>(
    `/admin/identities${query ? `?${query}` : ""}`,
    {
      admin: true,
    },
  );
}

export type KratosWebhookPayload = {
  identity?: KratosIdentity;
  type?: string; // event type — registration, update, etc.
};

// webhook body parse — identity extract; missing id → 400 invalid_webhook
export function parseKratosWebhookPayload(body: unknown): KratosIdentity {
  if (body === null || typeof body !== "object") {
    throw new AppError(
      "Invalid Kratos webhook payload.",
      400,
      "invalid_webhook",
    );
  }
  const payload = body as KratosWebhookPayload;
  const identity = payload.identity ?? (body as KratosIdentity); // support wrapped or direct identity object
  if (!identity?.id || typeof identity.id !== "string") {
    throw new AppError(
      "Invalid Kratos webhook payload.",
      400,
      "invalid_webhook",
    );
  }
  assertKratosIdentityId(identity.id);
  return identity;
}

// webhook shared secret verify — header match; secret unset = dev mode pass-through
export function verifyKratosWebhookSecret(headerValue: string | null): boolean {
  const secret = env.oryKratosWebhookSecret;
  if (!secret) return true; // no secret configured — skip verification (local dev; route blocks prod)
  if (!headerValue) return false;
  return secretsEqual(headerValue, secret);
}
