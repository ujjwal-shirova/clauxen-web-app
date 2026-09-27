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

    const [status, markedIds] = await Promise.all([
      getChatCoordStatus(params.chatId),
      chatsRepo.listGeneratingChatIds(user.id),
    ]);
    const marked = markedIds.includes(params.chatId);
    // The coordinator is the live lease. A stale metadata flag is cleared
    // when the lease is gone so a finished turn does not keep spinning.
    // A finished answer also wins over a lease that was not released: the
    // saved row is the source of truth for the composer stop button.
    if (status && !status.active && marked) {
      await chatsRepo.setChatGenerating(params.chatId, user.id, false);
    }
    const active = status ? status.active && marked : marked;
    return Response.json(
      {
        data: {
          active,
          stopRequested: status?.stopRequested ?? false,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
