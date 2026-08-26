import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as tasksRepo from "@/server/repositories/scheduled-tasks.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const raw = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(raw)
      ? Math.min(Math.max(1, Math.floor(raw)), 100)
      : 50;
    const runs = await tasksRepo.listRecentRunsForUser(user.id, limit);
    return jsonData({ runs });
  },
  { requireAuth: true },
);
