// Params: chatId — URL dynamic segment
// GET: keyset message page — conversation thread render
// POST: new user message insert — 201 Created
// =============================================================================

import type { NextRequest } from "next/server";
import { withApiRouteParams } from "@/server/http/route-params"; // [chatId] params inject + auth gates
import { jsonData } from "@/server/http/api-response"; // { data: … } success envelope
import { requireSession } from "@/server/auth/require-session"; // null session → 401
import { createSupabaseClientFromRequest } from "@/server/auth/supabase-session";
import { AppError } from "@/server/db/errors"; // validation errors — 400 bad request
import * as chatService from "@/server/services/chat.service"; // ownership check + appendUserMessage business logic

const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024; // cap oversized payloads — DoS mitigation on text column inserts
const DEFAULT_PAGE_LIMIT = 500;

export const runtime = "nodejs"; // Node.js — pg pool queries
export const dynamic = "force-dynamic";

async function accessTokenFromRequest(
  request: NextRequest,
): Promise<string | null> {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params, request }) => {
    const user = requireSession(session); // authenticated user id
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw
      ? Math.min(500, Math.max(1, Number(limitRaw) || DEFAULT_PAGE_LIMIT))
      : DEFAULT_PAGE_LIMIT;
    const cursorId = url.searchParams.get("cursor_id");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
    const accessToken = await accessTokenFromRequest(request);

    const page = await chatService.getChatMessagesPage(params.chatId, user.id, {
      cursorId,
      cursorCreatedAt,
      limit,
      accessToken,
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
