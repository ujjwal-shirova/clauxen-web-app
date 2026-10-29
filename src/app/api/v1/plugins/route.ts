import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";
import { jsonData } from "@/server/http/api-response";
import { getConnectorOverview, withConnectorErrors } from "@/server/plugins/service";

export const GET = withApiHandler(async ({ session }) => {
  const user = requireSession(session);
  return withConnectorErrors(async () => {
    const response = jsonData(await getConnectorOverview(user.id));
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}, { requireAuth: true });
