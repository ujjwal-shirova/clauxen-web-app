import { withApiRouteParams } from "@/backend/http/route-params"; // chatId param + auth wrapper
import { jsonData } from "@/backend/http/api-response"; // { data: { title } }
import { requireSession } from "@/backend/auth/require-session"; // session mandatory
import { AppError } from "@/backend/db/errors"; // structured 400 validation errors
import * as chatService from "@/backend/services/chat.service"; // title generation + DB persist
import { sanitizeMessages } from "@/backend/inference/novita"; // client messages → model-safe format

export const runtime = "nodejs"; // Node.js — upstream LLM HTTP calls
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session); // owner user id
    const body = (await request.json().catch(() => ({}))) as {
      messages?: unknown;
    }; // invalid JSON → empty — safe fallback
    const messages = sanitizeMessages(body.messages); // role/content normalize — invalid entries drop
    if (!messages.length) {
      throw new AppError("messages are required.", 400); // empty/invalid payload — skip LLM call
    }
    const title = await chatService.generateChatTitle(
      params.chatId,
      user.id,
      messages,
    ); // LLM call + chats.title UPDATE
    return jsonData({ title }); // generated string — sidebar/list UI update
  },
  { requireAuth: true, requireChatAuth: true },
);
