import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatService from "@/server/services/chat.service";
import { AppError } from "@/server/db/errors";
import { isValidChatId } from "@/lib/chat-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const projectId =
      new URL(request.url).searchParams.get("projectId") ?? undefined;
    const chats = await chatService.listRecentChats(user.id, projectId);
    return jsonData({ chats });
  },
  { requireAuth: true, requireChatAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      title?: string;
      projectId?: string;
    };
    const requestedId =
      typeof body.id === "string" && isValidChatId(body.id.trim())
        ? body.id.trim()
        : undefined;
    const chat = await chatService.createChatForUser(user.id, {
      id: requestedId,
      title: body.title,
      projectId: body.projectId ?? null,
    });
    if (!chat) throw new AppError("Failed to create chat.", 500);
    return jsonData({ chat }, 201);
  },
  { requireAuth: true, requireChatAuth: true },
);
