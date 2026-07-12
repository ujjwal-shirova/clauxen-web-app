import { AppError } from "@/backend/db/errors";
import { query } from "@/backend/db/pool";
import * as profileRepo from "@/backend/repositories/profile.repository";
import * as settingsRepo from "@/backend/repositories/settings.repository";
import * as filesService from "@/backend/services/files.service";
import {
  resolveAuthAvatarUrl,
  resolveAuthFullName,
  trimProfileName,
} from "@/lib/profile-names";

const AVATAR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function getProfileForUser(userId: string) {
  return profileRepo.getProfile(userId);
}

export async function syncProfileFromAuth(input: {
  userId: string;
  email?: string | null;
  authMetadata?: Record<string, unknown> | null;
}) {
  const authFullName = resolveAuthFullName(input.authMetadata);
  const authAvatar = resolveAuthAvatarUrl(input.authMetadata);
  const existing = await profileRepo.getProfile(input.userId);
  const emailLocal = input.email?.split("@")[0] || "User";

  let displayName = existing?.display_name?.trim() || null;
  if (!displayName || displayName === emailLocal) {
    displayName = authFullName ?? displayName ?? emailLocal;
  }

  const row = await profileRepo.updateProfile(input.userId, {
    displayName,
    ...(authAvatar && !existing?.avatar_url ? { avatarUrl: authAvatar } : {}),
  });

  if (authFullName) {
    await mirrorPersonalizationNames(input.userId, {
      fullName: authFullName,
    });
  }

  return row;
}

export async function applyOnboardingProfile(
  userId: string,
  input: {
    preferredName?: string | null;
    role?: string | null;
    authFullName?: string | null;
  },
) {
  const preferredName = trimProfileName(input.preferredName);
  const role = trimProfileName(input.role);
  const authFullName = trimProfileName(input.authFullName);
  const existing = await profileRepo.getProfile(userId);

  const displayName =
    authFullName ??
    trimProfileName(existing?.display_name) ??
    preferredName ??
    null;

  await profileRepo.updateProfile(userId, {
    displayName,
    preferredName: preferredName ?? undefined,
  });

  if (preferredName || role || displayName) {
    await mirrorPersonalizationNames(userId, {
      fullName: displayName,
      nickname: preferredName,
      occupation: role,
    });
  }

  if (preferredName) {
    await query(
      `update auth.users
       set raw_user_meta_data =
             coalesce(raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('preferred_name', $2::text),
           updated_at = now()
       where id = $1`,
      [userId, preferredName],
    );
  }

  if (displayName) {
    await query(
      `update public.user_settings
       set display_name = $2, updated_at = now()
       where user_id = $1`,
      [userId, displayName],
    );
  }

  return profileRepo.getProfile(userId);
}

export async function updateUserProfile(
  userId: string,
  input: {
    fullName?: string;
    preferredName?: string;
    occupation?: string;
    avatarFileId?: string;
  },
) {
  const fullName = trimProfileName(input.fullName);
  const preferredName = trimProfileName(input.preferredName);
  const occupation = trimProfileName(input.occupation);

  let avatarUrl: string | null | undefined;
  if (input.avatarFileId) {
    avatarUrl = await resolveAvatarUrl(userId, input.avatarFileId);
  }

  await profileRepo.updateProfile(userId, {
    ...(fullName !== null ? { displayName: fullName } : {}),
    ...(preferredName !== null ? { preferredName } : {}),
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  });

  await mirrorPersonalizationNames(userId, {
    fullName: fullName ?? undefined,
    nickname: preferredName ?? undefined,
    occupation: occupation ?? undefined,
  });

  if (fullName) {
    await query(
      `update public.user_settings
       set display_name = $2, updated_at = now()
       where user_id = $1`,
      [userId, fullName],
    );
  }

  if (preferredName) {
    await query(
      `update auth.users
       set raw_user_meta_data =
             coalesce(raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('preferred_name', $2::text),
           updated_at = now()
       where id = $1`,
      [userId, preferredName],
    );
  }

  return profileRepo.getProfile(userId);
}

async function resolveAvatarUrl(userId: string, fileId: string) {
  const download = await filesService.getUserFileDownloadUrl(userId, fileId);
  return download.url;
}

export function assertAvatarMime(mimeType: string | null | undefined) {
  const mime = (mimeType ?? "").toLowerCase();
  if (!AVATAR_MIMES.has(mime)) {
    throw new AppError(
      "Avatar must be PNG, JPEG, WebP, or GIF.",
      400,
      "invalid_avatar_type",
    );
  }
}

async function mirrorPersonalizationNames(
  userId: string,
  patch: {
    fullName?: string | null;
    nickname?: string | null;
    occupation?: string | null;
  },
) {
  const current = await settingsRepo.getUserSettings(userId);
  const settings = (current?.settings ?? {}) as Record<string, unknown>;
  const personalization = {
    ...((settings.personalization as Record<string, unknown>) ?? {}),
  };

  if (patch.fullName) personalization.fullName = patch.fullName;
  if (patch.nickname) personalization.nickname = patch.nickname;
  if (patch.occupation) personalization.occupation = patch.occupation;

  await settingsRepo.updateUserSettings(userId, {
    settings: { ...settings, personalization },
  });
}
