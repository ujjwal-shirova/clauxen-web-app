import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import { getChatCoordStatus } from "@/server/chat/chat-coord-client";
import * as chatsRepo from "@/server/repositories/chats.repository";
import { notFound } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only coordination status used to wait a durable queued turn. */
export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const chat = await chatsRepo.getChatForUser(params.chatId, user.id);
    if (!chat) throw notFound("Chat not found.");

    const status = await getChatCoordStatus(params.chatId);
    return Response.json(
      {
        data: {
          active: status?.active ?? false,
          stopRequested: status?.stopRequested ?? false,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
