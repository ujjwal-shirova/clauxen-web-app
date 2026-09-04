import { AppError, notFound } from "@/server/db/errors";
import { query } from "@/server/db/pool";
import * as profileRepo from "@/server/repositories/profile.repository";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import { getObject } from "@/server/storage/object-store";
import { storedAvatarSrc } from "@/lib/avatar-url";

const AVATAR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function assertAvatarMime(mimeType: string | null | undefined) {
  const mime = (mimeType ?? "").toLowerCase();
  if (!AVATAR_MIMES.has(mime)) {
    throw new AppError(
      "Avatar must be PNG, JPEG, WebP, or GIF.",
      400,
      "invalid_avatar_type",
    );
  }
}

export async function attachUploadedAvatar(userId: string, fileId: string) {
  const file = await userFilesRepo.getUserFile(fileId, userId);
  if (!file) throw notFound("Avatar file not found.");
  assertAvatarMime(file.mime_type);

  const avatarUrl = storedAvatarSrc(userId, Date.now());
  const profile = await profileRepo.setProfileAvatar(userId, {
    fileId: file.id,
    storageBucket: file.storage_bucket,
    storagePath: file.storage_path,
    avatarUrl,
  });

  await query(
    `update public.user_settings
     set avatar_url = $2, updated_at = now()
     where user_id = $1`,
    [userId, avatarUrl],
  );

  return profile;
}

export async function getAvatarBytes(userId: string) {
  const file = await userFilesRepo.getPublicAvatarFile(userId);
  if (!file) return null;

  const purpose = file.mime_type?.startsWith("image/") ? "images" : "documents";
  const body = await getObject(
    purpose,
    file.storage_path,
    file.storage_bucket,
  );

  return {
    body,
    contentType: file.mime_type || "image/jpeg",
    updatedAt: file.updated_at,
    contentHash: file.content_hash,
  };
}
