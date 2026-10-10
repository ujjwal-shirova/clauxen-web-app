import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { runTaskNow } from "@/server/services/scheduled-tasks.service";

export const runtime = "nodejs";
export const POST = withApiRouteParams<{ taskId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    return jsonData(await runTaskNow(params.taskId, user.id), 202);
  },
  { requireAuth: true },
);
