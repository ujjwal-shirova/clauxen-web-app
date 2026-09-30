// Params: chatId — URL dynamic segment; user-scoped access only
// Use case: switch the visible branch at a fork point (branch arrows UI).
// The message tree in chat_messages is the source of truth; this endpoint
// moves chats.active_leaf_message_id and returns the refreshed thread page.
// =============================================================================

import { withApiRouteParams } from "@/server/http/route-params"; // [chatId] params inject + auth gates wrap
import { jsonData } from "@/server/http/api-response"; // { data: … } success envelope
import { requireSession } from "@/server/auth/require-session"; // null session → 401 AppError
import { AppError } from "@/server/db/errors"; // validation errors — malformed body
import * as chatService from "@/server/services/chat.service"; // ownership check + tree switch

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session); // authenticated user id — unauthenticated → reject
    let body: { messageId?: unknown };
    try {
      body = (await request.json()) as { messageId?: unknown };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const messageId =
      typeof body.messageId === "string" ? body.messageId.trim() : "";
    if (!messageId || messageId.length > 64) {
      throw new AppError("messageId is required.", 400, "invalid_message_id");
    }
    // Ownership verify + leaf move + refreshed active path page.
    const result = await chatService.switchThreadBranch(
      params.chatId,
      user.id,
      messageId,
    );
    return jsonData(result);
  },
  { requireAuth: true, requireChatAuth: true },
);