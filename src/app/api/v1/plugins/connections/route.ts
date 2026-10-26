import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { connectionDto } from "@/server/plugins/connection-dto";
import * as repo from "@/server/repositories/plugin-connections.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/plugins/connections — the signed-in user's connected plugins. */
export const GET = withApiHandler(
  async ({ session }) => {
    if (!session) return jsonData({ connections: [] });
    const rows = await repo.listConnectionsForUser(session.id);
    return jsonData({ connections: rows.map(connectionDto) });
  },
  { requireAuth: false },
);
