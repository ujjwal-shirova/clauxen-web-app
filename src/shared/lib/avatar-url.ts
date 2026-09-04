const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAvatarUserId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** Same-origin URL that streams the user's current R2 profile photo. */
export function storedAvatarSrc(
  userId: string,
  version?: string | number | null,
) {
  const stamp =
    typeof version === "number"
      ? version
      : version
        ? Date.parse(String(version)) || Date.now()
        : Date.now();
  return `/api/v1/avatars/${userId}?v=${stamp}`;
}

export function resolveClientAvatarUrl(input: {
  userId: string;
  avatarFileId?: string | null;
  avatarStoragePath?: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | number | null;
}): string | null {
  if (input.avatarFileId || input.avatarStoragePath) {
    return storedAvatarSrc(input.userId, input.avatarUpdatedAt);
  }
  const url = input.avatarUrl?.trim();
  return url ? url : null;
}
