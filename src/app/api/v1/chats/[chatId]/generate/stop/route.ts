import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import { abortChatGeneration } from "@/server/chat/generation-registry";
import { stopChatJob } from "@/server/chat/durable-generation";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Explicit stop — cancels the durable background job (live slice and any
 * chained headless slices abort within seconds), flags the coordinator, and
 * settles the visible message + generating flag at once. Does not rely on
 * client disconnect.
 */
export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const [aborted, stopped] = await Promise.all([
      // In-process live slice on this isolate (plus the coordinator flag
      // for slices on other isolates).
      abortChatGeneration(params.chatId),
      // Durable job row: running slices poll this and abort promptly.
      stopChatJob(params.chatId, user.id),
    ]);

    try {
      const { invalidateChatHistoryCache } = await import(
        "@/server/chat/warm-history-cache"
      );
      await invalidateChatHistoryCache({
        userId: user.id,
        chatId: params.chatId,
      });
    } catch {
      // ignore
    }

    return Response.json({
      data: { aborted: aborted || stopped.cancelledJobs > 0 },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
