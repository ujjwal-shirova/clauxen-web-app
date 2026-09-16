import { requireSession } from "@/server/auth/require-session";
import { listConnectorConnections } from "@/connectors/server/gateway";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    return jsonData(await listConnectorConnections(user.id));
  },
  { requireAuth: true },
);
