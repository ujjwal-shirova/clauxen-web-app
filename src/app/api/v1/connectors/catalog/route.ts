import { requireSession } from "@/server/auth/require-session";
import { listPlatformConnectors } from "@/connectors/server/rest-catalog";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    return jsonData(await listPlatformConnectors(user.id));
  },
  { requireAuth: true },
);
