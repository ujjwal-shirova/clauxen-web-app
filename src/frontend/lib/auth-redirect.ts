import { APP_ROUTES, legacyHashToPath } from "@/frontend/lib/app-routes";

/** Safe post-auth redirect path (never open redirect). */
export function getSafeRedirectTo(value: string | null): string {
  if (!value) return APP_ROUTES.newChat;
  if (value.startsWith("/") && !value.startsWith("//")) {
    if (value === "/" || value === "") return APP_ROUTES.newChat;
    return value;
  }
  return APP_ROUTES.newChat;
}

/** Map legacy overlay hashes (#settings/General) to shareable paths after auth. */
export function redirectTargetWithHash(path: string): string {
  if (typeof window === "undefined") return path;
  const mapped = legacyHashToPath(window.location.hash);
  if (mapped) return mapped;
  const hash = window.location.hash;
  if (!hash || hash === "#") return path;
  if (path.includes("#")) return path;
  return `${path}${hash}`;
}
