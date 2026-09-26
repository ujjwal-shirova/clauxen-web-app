import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as projectsRepo from "@/server/repositories/projects.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const project = await projectsRepo.getProjectForChat(params.chatId, user.id);
    return jsonData({ project: project ?? null });
  },
  { requireAuth: true, requireChatAuth: true },
);
