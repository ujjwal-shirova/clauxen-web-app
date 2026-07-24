// Params: projectId — URL dynamic segment
// =============================================================================

import { withApiRouteParams } from "@/server/http/route-params"; // typed params + withApiHandler wrapper
import { jsonData } from "@/server/http/api-response"; // { data: { chat } } success JSON
import { requireSession } from "@/server/auth/require-session"; // null session → 401
import * as projectsRepo from "@/server/repositories/projects.repository"; // project lookup — user_id scoped
import * as chatsRepo from "@/server/repositories/chats.repository"; // chat update — project_id column set
import { AppError, notFound } from "@/server/db/errors"; // 400 validation, 404 missing resources
import { requireChatIdParam } from "@/server/http/chat-id";

// UUID shape — malformed project ids fail fast with 400 instead of database_error 500
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs"; // Node.js runtime — pg parameterized queries
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ projectId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    if (!UUID_RE.test(params.projectId)) {
      throw new AppError("Invalid project id.", 400, "bad_request");
    }
    const project = await projectsRepo.getProject(params.projectId, user.id); // SQL: project id + user_id — cross-user project block
    if (!project) throw notFound("Project not found.");

    const body = (await request.json().catch(() => {
      throw new AppError("Invalid JSON body.", 400, "bad_request");
    })) as { chatId?: unknown };
    const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
    if (!chatId) {
      throw new AppError("chatId is required.", 400);
    }
    requireChatIdParam(chatId);

    const chat = await chatsRepo.updateChat(chatId, user.id, {
      projectId: params.projectId, // chats.project_id column update — sidebar project grouping
    });
    if (!chat) throw notFound("Chat not found.");

    return jsonData({ chat }); // updated chat metadata — frontend project view refresh
  },
  { requireAuth: true },
);
