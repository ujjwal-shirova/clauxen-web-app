import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as pinnedChatsRepo from "@/backend/repositories/pinned-chats.repository";
import { requireChatIdParam } from "@/backend/http/chat-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);

    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const pinned = await pinnedChatsRepo.pinChat(params.chatId, user.id);
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
    return jsonData({ ok: true });
  },
  { requireAuth: true, requireChatAuth: true },
);
