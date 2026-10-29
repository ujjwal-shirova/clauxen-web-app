import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";
import { jsonData } from "@/server/http/api-response";
import { assertMutationOrigin } from "@/server/plugins/oauth";
import { disconnectConnector, withConnectorErrors } from "@/server/plugins/service";

export async function DELETE(request: NextRequest, context: { params: Promise<{ connectionId: string }> }) {
  return withApiHandler(async ({ request, session }) => {
    const user = requireSession(session);
    const { connectionId } = await context.params;
    return withConnectorErrors(async () => {
      assertMutationOrigin(request);
      await disconnectConnector(user.id, connectionId);
      const response = jsonData({ disconnected: true });
      response.headers.set("Cache-Control", "no-store");
      return response;
    });
  }, { requireAuth: true })(request);
}
