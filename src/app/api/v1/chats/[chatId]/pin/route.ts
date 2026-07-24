import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { notFound } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as pinnedChatsRepo from "@/server/repositories/pinned-chats.repository";
import { requireChatIdParam } from "@/server/http/chat-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);

    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const pinned = await pinnedChatsRepo.pinChat(params.chatId, user.id);
    const { invalidateChatHistoryCache } = await import(
      "@/server/chat/warm-history-cache"
    );
    await invalidateChatHistoryCache({ userId: user.id, listsOnly: true });
    return jsonData({ pinned }, 201);
  },
  { requireAuth: true, requireChatAuth: true },
);

export const DELETE = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);

    const unpinned = await pinnedChatsRepo.unpinChat(params.chatId, user.id);
    if (!unpinned) throw notFound("Pinned chat not found.");
    const { invalidateChatHistoryCache } = await import(
      "@/server/chat/warm-history-cache"
    );
    await invalidateChatHistoryCache({ userId: user.id, listsOnly: true });
    return jsonData({ ok: true });
  },
  { requireAuth: true, requireChatAuth: true },
);
