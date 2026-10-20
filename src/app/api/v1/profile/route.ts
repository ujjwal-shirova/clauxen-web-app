import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as profileService from "@/server/services/profile.service";
import { AppError } from "@/server/db/errors";

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
    username: row?.username ?? null,
    avatarUrl: profileService.toClientAvatarUrl(row),
    avatarShape: row?.avatar_shape ?? "circle",
    visibility: {
      usageStatistics: row?.show_usage_statistics ?? true,
      activityGraph: row?.show_activity_graph ?? true,
      topPlugins: row?.show_top_plugins ?? true,
      insights: row?.show_insights ?? true,
    },
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
      username?: string;
      avatarShape?: string;
      showUsageStatistics?: boolean;
      showActivityGraph?: boolean;
      showTopPlugins?: boolean;
      showInsights?: boolean;
    };

    if (body.username !== undefined && typeof body.username !== "string") {
      throw new AppError("username must be a string.", 400, "invalid_body");
    }
    if (
      body.avatarShape !== undefined &&
      typeof body.avatarShape !== "string"
    ) {
      throw new AppError("avatarShape must be a string.", 400, "invalid_body");
    }
    for (const field of [
      "showUsageStatistics",
      "showActivityGraph",
      "showTopPlugins",
      "showInsights",
    ] as const) {
      if (body[field] !== undefined && typeof body[field] !== "boolean") {
        throw new AppError(`${field} must be a boolean.`, 400, "invalid_body");
      }
    }

    const profile = await profileService.updateUserProfile(user.id, {
      fullName: body.fullName,
      preferredName: body.preferredName,
      occupation: body.occupation,
      avatarFileId: body.avatarFileId,
      username: body.username,
      avatarShape: body.avatarShape,
      showUsageStatistics: body.showUsageStatistics,
      showActivityGraph: body.showActivityGraph,
      showTopPlugins: body.showTopPlugins,
      showInsights: body.showInsights,
    });

    return jsonData({ profile: toClientProfile(profile) });
  },
  { requireAuth: true },
);
