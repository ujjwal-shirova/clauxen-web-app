import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError, notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as pinnedChatsRepo from "@/backend/repositories/pinned-chats.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireChatId(chatId: string) {
  if (!UUID_RE.test(chatId)) {
    throw new AppError("Invalid chat id.", 400, "bad_request");
  }
}

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    requireChatId(params.chatId);

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
    requireChatId(params.chatId);

    const unpinned = await pinnedChatsRepo.unpinChat(params.chatId, user.id);
    if (!unpinned) throw notFound("Pinned chat not found.");
    return jsonData({ ok: true });
  },
  { requireAuth: true, requireChatAuth: true },
);
