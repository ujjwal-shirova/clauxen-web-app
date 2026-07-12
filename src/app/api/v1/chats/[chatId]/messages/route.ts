// Params: chatId — URL dynamic segment
// GET: keyset message page — conversation thread render
// POST: new user message insert — 201 Created
// =============================================================================

import { withApiRouteParams } from "@/backend/http/route-params"; // [chatId] params inject + auth gates
import { jsonData } from "@/backend/http/api-response"; // { data: … } success envelope
import { requireSession } from "@/backend/auth/require-session"; // null session → 401
import { AppError } from "@/backend/db/errors"; // validation errors — 400 bad request
import * as chatService from "@/backend/services/chat.service"; // ownership check + appendUserMessage business logic

const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024; // cap oversized payloads — DoS mitigation on text column inserts
const DEFAULT_PAGE_LIMIT = 20;

export const runtime = "nodejs"; // Node.js — pg pool queries
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params, request }) => {
    const user = requireSession(session); // authenticated user id
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw
      ? Math.min(50, Math.max(1, Number(limitRaw) || DEFAULT_PAGE_LIMIT))
      : DEFAULT_PAGE_LIMIT;
    const cursorId = url.searchParams.get("cursor_id");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");

    const page = await chatService.getChatMessagesPage(params.chatId, user.id, {
      cursorId,
      cursorCreatedAt,
      limit,
    });

    return jsonData({
      messages: page.messages,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
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
