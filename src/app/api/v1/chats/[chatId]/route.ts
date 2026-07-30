import { withApiRouteParams } from "@/server/http/route-params"; // [chatId] params inject + auth gates
import { jsonData } from "@/server/http/api-response"; // { data } success envelope
import { requireSession } from "@/server/auth/require-session"; // null session → 401
import * as chatsRepo from "@/server/repositories/chats.repository"; // PATCH/DELETE — direct chat row updates
import * as chatService from "@/server/services/chat.service";
import { notFound } from "@/server/db/errors";
import { requireChatIdParam } from "@/server/http/chat-id";
import { archiveChatSnapshot, purgeChatMessagesAfterArchive } from "@/server/chat/chat-archive";

const MAX_CHAT_TITLE_LENGTH = 200;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session); // authenticated user id
    requireChatIdParam(params.chatId);
    // Latest keyset page only — full history is loaded via /messages?cursor_*
    const page = await chatService.getChatMessagesPage(params.chatId, user.id, {
      limit: 2,
    });
    return jsonData({
      chat: page.chat,
      messages: page.messages,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  },
  { requireAuth: true, requireChatAuth: true },
);

export const PATCH = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      title?: string;
      starred?: boolean;
      projectId?: string | null;
    };
    const chat = await chatsRepo.updateChat(params.chatId, user.id, body); // WHERE chat_id AND user_id — scoped update
    if (!chat) throw notFound("Chat not found.");
    const { invalidateChatHistoryCache } = await import(
      "@/server/chat/warm-history-cache"
    );
    await invalidateChatHistoryCache({
      userId: user.id,
      chatId: params.chatId,
    });
    return jsonData({ chat }); // updated chat object client state sync
  },
  { requireAuth: true, requireChatAuth: true },
);

export const DELETE = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);
    // Tombstone to R2 first so the chat is recoverable after soft-delete.
    const { snapshotted } = await archiveChatSnapshot({
      chatId: params.chatId,
      userId: user.id,
      reason: "deleted",
    });
    await chatsRepo.deleteChat(params.chatId, user.id);
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
    return jsonData({ ok: true }); // success confirmation, body minimal
  },
  { requireAuth: true, requireChatAuth: true },
);
