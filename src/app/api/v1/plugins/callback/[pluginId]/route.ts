import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";
import { completeConnectorConnect, withConnectorErrors } from "@/server/plugins/service";

export async function GET(request: NextRequest, context: { params: Promise<{ pluginId: string }> }) {
  return withApiHandler(async ({ request, session }) => {
    const user = requireSession(session);
    const { pluginId } = await context.params;
    return withConnectorErrors(() => completeConnectorConnect(user.id, pluginId, request));
  }, { requireAuth: true })(request);
}
