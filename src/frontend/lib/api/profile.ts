import { apiFetch } from "@/frontend/lib/api/client";
import * as filesApi from "@/frontend/lib/api/files";

export type UserProfile = {
  id: string | null;
  email: string | null;
  fullName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
};

const AVATAR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function getProfile() {
  const data = await apiFetch<{ profile: UserProfile }>("/api/v1/profile");
  return data.profile;
}

export async function updateProfile(patch: {
  fullName?: string;
  preferredName?: string;
  occupation?: string;
  avatarFileId?: string;
}) {
  const data = await apiFetch<{ profile: UserProfile }>("/api/v1/profile", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.profile;
}

/** Presign → PUT → complete → attach avatar to profile. */
export async function uploadAvatar(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (!AVATAR_MIMES.has(mime)) {
    throw new Error("Avatar must be PNG, JPEG, WebP, or GIF.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Avatar must be 2 MB or smaller.");
  }

  const { fileId, uploadUrl, method, stub } = await filesApi.presignUpload({
    originalName: file.name,
    mimeType: mime,
    sizeBytes: file.size,
    purpose: "avatar",
  });

  if (!stub) {
    const upload = await fetch(uploadUrl, {
      method: method || "PUT",
      body: file,
      headers: { "content-type": mime },
    });
    if (!upload.ok) {
      throw new Error("Avatar upload failed.");
    }
  }

  await filesApi.completeUpload({ fileId, sizeBytes: file.size });
  return updateProfile({ avatarFileId: fileId });
}
