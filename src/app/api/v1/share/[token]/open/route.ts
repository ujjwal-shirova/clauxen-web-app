import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { applySharePrivacyHeaders } from "@/server/http/share-privacy";
import { AppError } from "@/server/db/errors";
import { openSharedChat } from "@/server/services/chat-share.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ token: string }>(
  async ({ request, params }) => {
    try {
      const snapshot = await openSharedChat(request, params.token);
      return applySharePrivacyHeaders(jsonData(snapshot));
    } catch (error) {
      if (error instanceof AppError && error.code === "database_error") {
        throw new AppError(
          "Could not open this chat. Try again.",
          503,
          "share_unavailable",
        );
      }
      throw error;
    }
  },
  { requireAuth: false },
);
