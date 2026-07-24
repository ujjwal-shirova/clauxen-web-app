import { queryOne } from "@/server/db/pool";

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

export async function getProfile(userId: string) {
  return queryOne<ProfileRow>(
    `select id, email, display_name, preferred_name, avatar_url
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
     returning id, email, display_name, preferred_name, avatar_url`,
    [
      userId,
      patch.displayName !== undefined ? patch.displayName : null,
      patch.preferredName !== undefined ? patch.preferredName : null,
      patch.avatarUrl !== undefined ? patch.avatarUrl : null,
    ],
  );
}
