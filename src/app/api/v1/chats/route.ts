import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as chatService from "@/backend/services/chat.service";
import { AppError } from "@/backend/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const projectId =
      new URL(request.url).searchParams.get("projectId") ?? undefined;
    const chats = await chatService.listRecentChats(user.id);
    const filtered = projectId
      ? chats.filter((c) => c.projectId === projectId)
      : chats;
    return jsonData({ chats: filtered });
  },
  { requireAuth: true, requireChatAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      projectId?: string;
    };
    const chat = await chatService.createChatForUser(user.id, {
      title: body.title,
      projectId: body.projectId ?? null,
    });
    if (!chat) throw new AppError("Failed to create chat.", 500);
    return jsonData({ chat }, 201);
  },
  { requireAuth: true, requireChatAuth: true },
);
