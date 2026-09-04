import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as profileService from "@/server/services/profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toClientProfile(
  row: Awaited<ReturnType<typeof profileService.getProfileForUser>>,
) {
  return {
    id: row?.id ?? null,
    email: row?.email ?? null,
    fullName: row?.display_name ?? null,
    preferredName: row?.preferred_name ?? null,
    avatarUrl: profileService.toClientAvatarUrl(row),
  };
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const profile = await profileService.getProfileForUser(user.id);
    return jsonData({ profile: toClientProfile(profile) });
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      fullName?: string;
      preferredName?: string;
      occupation?: string;
      avatarFileId?: string;
    };

    const profile = await profileService.updateUserProfile(user.id, {
      fullName: body.fullName,
      preferredName: body.preferredName,
      occupation: body.occupation,
      avatarFileId: body.avatarFileId,
    });

    return jsonData({ profile: toClientProfile(profile) });
  },
  { requireAuth: true },
);
