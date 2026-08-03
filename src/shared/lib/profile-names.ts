const MAX_NAME_LEN = 120;

export function trimProfileName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_NAME_LEN);
  return trimmed || null;
}

/** OAuth / Supabase user_metadata → legal or account display name. */
export function resolveAuthFullName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  for (const key of [
    "full_name",
    "name",
    "display_name",
    // X / Twitter OAuth 2.0 (+ legacy OAuth 1.0a) username fields
    "user_name",
    "preferred_username",
    "screen_name",
    "username",
  ] as const) {
    const raw = metadata[key];
    const value = trimProfileName(typeof raw === "string" ? raw : null);
    if (value) {
      // X usernames often arrive without @ — keep as display when no full name.
      return value.startsWith("@") ? value.slice(1) : value;
    }
  }
  return null;
}

/** Avatar URL from common OAuth metadata shapes (Google / GitHub / X). */
export function resolveAuthAvatarUrl(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  for (const key of [
    "avatar_url",
    "picture",
    "profile_image_url",
    "profile_image_url_https",
  ] as const) {
    const raw = metadata[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/** First token for chat greetings — prefers preferred name, then full name. */
export function greetingFirstName(input: {
  preferredName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string | null {
  const raw =
    trimProfileName(input.preferredName) ??
    trimProfileName(input.fullName) ??
    trimProfileName(input.email?.split("@")[0] ?? null);
  if (!raw) return null;
  const first =
    raw.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}'-]/gu, "") ?? "";
  return first || null;
}

/**
 * Sidebar / account label when a real identity is known.
 * Returns null while auth/profile is still resolving — callers should skeleton.
 */
export function sidebarDisplayNameOrNull(input: {
  fullName?: string | null;
  preferredName?: string | null;
  email?: string | null;
}): string | null {
  return (
    trimProfileName(input.fullName) ??
    trimProfileName(input.preferredName) ??
    trimProfileName(input.email?.split("@")[0] ?? null)
  );
}

/** Sidebar / account label — full name, else preferred, else email local-part. */
export function sidebarDisplayName(input: {
  fullName?: string | null;
  preferredName?: string | null;
  email?: string | null;
  /** When true, never paint "Guest" — show a neutral placeholder instead. */
  authenticated?: boolean;
}): string {
  return (
    sidebarDisplayNameOrNull(input) ??
    (input.authenticated ? "Account" : "Guest")
  );
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

if (process.env.NODE_ENV !== "production") {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`profile-names selfcheck: ${msg}`);
  };
  assert(
    resolveAuthFullName({ full_name: "Jane Doe" }) === "Jane Doe",
    "oauth full_name",
  );
  assert(
    resolveAuthFullName({ user_name: "clauxen" }) === "clauxen",
    "x user_name",
  );
  assert(
    resolveAuthAvatarUrl({ profile_image_url_https: "https://x.test/a.jpg" }) ===
      "https://x.test/a.jpg",
    "x avatar",
  );
  assert(
    greetingFirstName({ preferredName: "Ujjwal Tyagi" }) === "Ujjwal",
    "greeting",
  );
  assert(
    sidebarDisplayName({ fullName: "Jane Doe", preferredName: "Jay" }) ===
      "Jane Doe",
    "sidebar full",
  );
}
