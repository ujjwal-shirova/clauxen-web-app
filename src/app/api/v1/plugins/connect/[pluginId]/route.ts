import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";
import { beginConnectorConnect, withConnectorErrors } from "@/server/plugins/service";

export async function POST(request: NextRequest, context: { params: Promise<{ pluginId: string }> }) {
  return withApiHandler(async ({ request, session }) => {
    const user = requireSession(session);
    const { pluginId } = await context.params;
    return withConnectorErrors(() => beginConnectorConnect(user.id, pluginId, request));
  }, { requireAuth: true })(request);
}
