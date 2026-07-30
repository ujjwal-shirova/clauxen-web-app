import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { notFound } from "@/server/db/errors";
import { requireChatIdParam } from "@/server/http/chat-id";
import { restoreChatFromArchive } from "@/server/chat/chat-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unarchive: restore from the R2 archive bucket and reactivate the row. */
export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);
    const restored = await restoreChatFromArchive({
      chatId: params.chatId,
      userId: user.id,
    });
    if (!restored) throw notFound("Chat archive not found.");
    const { invalidateChatHistoryCache } = await import(
      "@/server/chat/warm-history-cache"
    );
    await invalidateChatHistoryCache({
      userId: user.id,
      chatId: params.chatId,
    });
    return jsonData({ ok: true });
  },
  { requireAuth: true, requireChatAuth: true },
);
