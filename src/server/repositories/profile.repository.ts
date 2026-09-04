import { queryOne } from "@/server/db/pool";

const PROFILE_COLUMNS = `id, email, display_name, preferred_name, avatar_url,
  avatar_file_id, avatar_storage_bucket, avatar_storage_path, avatar_updated_at`;

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  avatar_file_id: string | null;
  avatar_storage_bucket: string | null;
  avatar_storage_path: string | null;
  avatar_updated_at: string | null;
};

export async function getProfile(userId: string) {
  return queryOne<ProfileRow>(
    `select ${PROFILE_COLUMNS}
     from public.profiles
     where id = $1`,
    [userId],
  );
}

export async function updateProfile(
  userId: string,
  patch: {
    displayName?: string | null;
    preferredName?: string | null;
    avatarUrl?: string | null;
  },
) {
  return queryOne<ProfileRow>(
    `update public.profiles set
       display_name = case when $2::text is not null then $2 else display_name end,
       preferred_name = case when $3::text is not null then $3 else preferred_name end,
       avatar_url = case when $4::text is not null then $4 else avatar_url end,
       updated_at = now()
     where id = $1
     returning ${PROFILE_COLUMNS}`,
    [
      userId,
      patch.displayName !== undefined ? patch.displayName : null,
      patch.preferredName !== undefined ? patch.preferredName : null,
      patch.avatarUrl !== undefined ? patch.avatarUrl : null,
    ],
  );
}

export async function setProfileAvatar(
  userId: string,
  input: {
    fileId: string;
    storageBucket: string;
    storagePath: string;
    avatarUrl: string;
  },
) {
  return queryOne<ProfileRow>(
    `update public.profiles set
       avatar_file_id = $2,
       avatar_storage_bucket = $3,
       avatar_storage_path = $4,
       avatar_url = $5,
       avatar_updated_at = now(),
       updated_at = now()
     where id = $1
     returning ${PROFILE_COLUMNS}`,
    [
      userId,
      input.fileId,
      input.storageBucket,
      input.storagePath,
      input.avatarUrl,
    ],
  );
}
