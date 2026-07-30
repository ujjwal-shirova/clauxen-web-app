import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { notFound } from "@/server/db/errors";
import { requireChatIdParam } from "@/server/http/chat-id";
import {
  archiveChatSnapshot,
  purgeChatMessagesAfterArchive,
} from "@/server/chat/chat-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Archive: snapshot the chat to R2, mark archived, then purge live messages. */
export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);
    const { snapshotted } = await archiveChatSnapshot({
      chatId: params.chatId,
      userId: user.id,
      reason: "archived",
    });
    const archived = await chatsRepo.archiveChat(params.chatId, user.id);
    if (!archived) throw notFound("Chat not found.");
    await purgeChatMessagesAfterArchive({
      chatId: params.chatId,
      snapshotted,
    });
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
