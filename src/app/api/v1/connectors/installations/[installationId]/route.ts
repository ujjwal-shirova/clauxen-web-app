import { requireSession } from "@/server/auth/require-session";
import { disconnectConnector } from "@/connectors/server/gateway";
import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApiRouteParams<{ installationId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    return jsonData(await disconnectConnector(user.id, params.installationId));
  },
  { requireAuth: true },
);
