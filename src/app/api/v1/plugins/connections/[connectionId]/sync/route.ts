import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import { syncCapabilities } from "@/server/plugins/plugin-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/plugins/connections/:id/sync — rediscover tools and resources. */
export const POST = withApiRouteParams<{ connectionId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    try {
      const toolCount = await syncCapabilities(params.connectionId, user.id);
      return jsonData({ toolCount });
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : "Could not refresh this plugin.",
        409,
        "sync_failed",
      );
    }
  },
  { requireAuth: true },
);
