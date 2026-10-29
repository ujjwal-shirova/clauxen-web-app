import { APP_ROUTES, parseOverlayHash } from "@/lib/app-routes";

/**
 * Paths browsers may treat as protocol-relative after normalisation.
 * `/\evil.com`, `/%5Cevil.com` and control-character tricks are all handled by
 * resolving against a fixed origin instead of pattern-matching the string.
 */
function isSameOriginPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  // Reject backslashes and control characters outright: browsers normalise
  // `\` to `/` in URLs, so `/\host` can leave the site.
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    return new URL(path, "https://clauxen.invalid").origin ===
      "https://clauxen.invalid";
  } catch {
    return false;
  }
}

/** Safe post-auth redirect path (never open redirect). Preserves hash. */
export function getSafeRedirectTo(value: string | null): string {
  if (!value) return APP_ROUTES.newChat;

  let path = value;
  let hash = "";
  const hashIdx = value.indexOf("#");
  if (hashIdx >= 0) {
    path = value.slice(0, hashIdx) || APP_ROUTES.newChat;
    hash = value.slice(hashIdx);
  }

  if (!isSameOriginPath(path)) {
    return hash && parseOverlayHash(hash)
      ? `${APP_ROUTES.newChat}${hash}`
      : APP_ROUTES.newChat;
  }

  if (path === "/" || path === "") {
    path = APP_ROUTES.newChat;
  }

  return `${path}${hash}`;
}

/**
 * After login, keep overlay hashes on the destination parent page
 * (e.g. `/new#settings/Personalization`).
 */
export function redirectTargetWithHash(path: string): string {
  if (typeof window === "undefined") return path;

  const hash = window.location.hash;
  if (!hash || hash === "#") return path;

  // Already has a hash.
  if (path.includes("#")) return path;

  // Overlay hash → append to safe parent path.
  if (parseOverlayHash(hash)) {
    const base = getSafeRedirectTo(path.split("#")[0] ?? path);
    const basePath = base.split("#")[0] || APP_ROUTES.newChat;
    return `${basePath}${hash}`;
  }

  return `${path}${hash}`;
}
