import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import { abortChatGeneration } from "@/backend/chat/generation-registry";
import * as messagesRepo from "@/backend/repositories/messages.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Explicit stop — does not rely on client disconnect (durable generation).
 */
export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    requireSession(session);
    const aborted = abortChatGeneration(params.chatId);

    try {
      const recent = await messagesRepo.listRecentMessagesForChat(
        params.chatId,
        8,
      );
      for (const row of recent) {
        if (row.role === "assistant" && row.status === "streaming") {
          await messagesRepo.updateMessageContent(
            row.id,
            params.chatId,
            row.content ?? "",
            "cancelled",
            row.content_json ?? {},
          );
        }
      }
    } catch {
      // ignore
    }

    return Response.json({ data: { aborted } });
  },
  { requireAuth: true, requireChatAuth: true },
);
