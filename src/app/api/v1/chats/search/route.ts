import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import * as messagesRepo from "@/backend/repositories/messages.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() ?? "";
    if (!q) {
      throw new AppError("Query parameter q is required.", 400);
    }
    if (q.length > 500) {
      throw new AppError("Search query is too long.", 400);
    }

    const limit = Number(params.get("limit") ?? "20");
    const results = await messagesRepo.searchMessagesForUser(user.id, q, limit);

    return jsonData({
      results: results.map((row) => ({
        messageId: row.message_id,
        chatId: row.chat_id,
        chatTitle: row.title,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        rank: row.rank,
      })),
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
