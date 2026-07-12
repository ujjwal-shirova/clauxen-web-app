import { withApiRouteParams } from "@/backend/http/route-params"; // [chatId] params inject + auth gates
import { jsonData } from "@/backend/http/api-response"; // { data } success envelope
import { requireSession } from "@/backend/auth/require-session"; // null session → 401
import * as chatsRepo from "@/backend/repositories/chats.repository"; // PATCH/DELETE — direct chat row updates
import * as chatService from "@/backend/services/chat.service";
import { notFound } from "@/backend/db/errors";
import { requireChatIdParam } from "@/backend/http/chat-id";

const MAX_CHAT_TITLE_LENGTH = 200;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session); // authenticated user id
    requireChatIdParam(params.chatId);
    const data = await chatService.getChatWithMessages(params.chatId, user.id); // ownership check + messages fetch
    return jsonData(data);
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
    return jsonData({ chat }); // updated chat object client state sync
  },
  { requireAuth: true, requireChatAuth: true },
);

export const DELETE = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatIdParam(params.chatId);
    await chatsRepo.deleteChat(params.chatId, user.id);
    return jsonData({ ok: true }); // success confirmation, body minimal
  },
  { requireAuth: true, requireChatAuth: true },
);
