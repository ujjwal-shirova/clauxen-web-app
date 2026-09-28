import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { readLiveTurn } from "@/server/chat/chat-coord-client";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live agent trace held on Cloudflare while a turn is running or waiting to archive. */
export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");
    const turn = await readLiveTurn(params.chatId);
    if (turn && turn.userId !== user.id) {
      return jsonData({ turn: null });
    }
    return jsonData({ turn });
  },
  { requireAuth: true, requireChatAuth: true },
);
