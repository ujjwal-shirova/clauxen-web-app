// Params: chatId — URL dynamic segment
// GET: messages array — conversation thread render
// POST: new user message insert — 201 Created
// =============================================================================

import { withApiRouteParams } from "@/backend/http/route-params"; // [chatId] params inject + auth gates
import { jsonData } from "@/backend/http/api-response"; // { data: … } success envelope
import { requireSession } from "@/backend/auth/require-session"; // null session → 401
import { AppError } from "@/backend/db/errors"; // validation errors — 400 bad request
import * as chatService from "@/backend/services/chat.service"; // ownership check + appendUserMessage business logic

const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024; // cap oversized payloads — DoS mitigation on text column inserts

export const runtime = "nodejs"; // Node.js — pg pool queries
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session); // authenticated user id
    const { messages } = await chatService.getChatWithMessages(
      params.chatId,
      user.id,
    ); // ownership verify + scoped list
    return jsonData({ messages }); // { data: { messages } } — frontend conversation thread hydrate
  },
  { requireAuth: true, requireChatAuth: true },
);

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session); // session user id — message author
    const body = (await request.json().catch(() => ({}))) as {
      content?: unknown;
      fileIds?: unknown;
    };
    if (body.content !== undefined && typeof body.content !== "string") {
      throw new AppError("content must be a string.", 400);
    }
    const content = typeof body.content === "string" ? body.content : "";
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((id): id is string => typeof id === "string")
      : undefined;
    if (content.length > MAX_MESSAGE_CONTENT_CHARS) {
      throw new AppError(
        "Message content is too long.",
        413,
        "payload_too_large",
      );
    }
    const message = await chatService.appendUserMessage(
      params.chatId,
      user.id,
      content,
      fileIds,
    ); // ownership check + INSERT message row + chat updated_at bump
    return jsonData({ message }, 201); // 201 Created — new message object client optimistic UI sync
  },
  { requireAuth: true, requireChatAuth: true },
);
