/**
 * Client-readable identity hint cookie (split session).
 * HttpOnly JWT stays in Supabase auth cookies; this only speeds UI paint
 * (sidebar name / avatar) before /api/v1/auth/session returns.
 */
export const IDENTITY_HINT_COOKIE = "clx_identity";

export type IdentityHint = {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
};

function encodeHint(hint: IdentityHint): string {
  const payload = JSON.stringify({
    i: hint.id,
    e: hint.email,
    d: hint.displayName,
    p: hint.preferredName,
    a: hint.avatarUrl,
  });
  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeHint(raw: string): IdentityHint | null {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(raw, "base64url").toString("utf8");
    } else {
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
      const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
      json = atob(padded + pad);
    }
    const parsed = JSON.parse(json) as {
      i?: string;
      e?: string | null;
      d?: string | null;
      p?: string | null;
      a?: string | null;
    };
    if (!parsed.i || typeof parsed.i !== "string") return null;
    return {
      id: parsed.i,
      email: parsed.e ?? null,
      displayName: parsed.d ?? null,
      preferredName: parsed.p ?? null,
      avatarUrl: parsed.a ?? null,
    };
  } catch {
    return null;
  }
}

export function identityHintCookieValue(hint: IdentityHint): string {
  return encodeHint(hint);
}

export function parseIdentityHintCookie(
  raw: string | null | undefined,
): IdentityHint | null {
  if (!raw) return null;
  return decodeHint(raw);
}

export function identityHintCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function readIdentityHintFromDocument(): IdentityHint | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${IDENTITY_HINT_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(IDENTITY_HINT_COOKIE.length + 1);
  try {
    return parseIdentityHintCookie(decodeURIComponent(value));
  } catch {
    return parseIdentityHintCookie(value);
  }
}

export function clearIdentityHintFromDocument() {
  if (typeof document === "undefined") return;
  document.cookie = `${IDENTITY_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
