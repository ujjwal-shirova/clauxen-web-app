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
    let body: {
      messageId?: unknown;
      direction?: unknown;
      targetIndex?: unknown;
      targetMessageId?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const messageId =
      typeof body.messageId === "string" ? body.messageId.trim() : "";
    if (!messageId || messageId.length > 64) {
      throw new AppError("messageId is required.", 400, "invalid_message_id");
    }
    const direction =
      body.direction === "prev" || body.direction === "next"
        ? body.direction
        : null;
    const targetIndex =
      typeof body.targetIndex === "number" && Number.isFinite(body.targetIndex)
        ? Math.max(0, Math.floor(body.targetIndex))
        : null;
    const targetMessageId =
      typeof body.targetMessageId === "string" && body.targetMessageId.trim()
        ? body.targetMessageId.trim()
        : null;

    // Ownership verify + leaf move + refreshed active path page.
    const result = await chatService.switchThreadBranch(
      params.chatId,
      user.id,
      messageId,
      direction,
      targetIndex,
      targetMessageId,
    );
    return jsonData(result);
  },
  { requireAuth: true, requireChatAuth: true },
);