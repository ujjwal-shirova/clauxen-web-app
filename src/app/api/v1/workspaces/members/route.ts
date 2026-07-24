import { unauthorized } from "@/server/db/errors";
import { withApiHandler } from "@/server/http/api-handler"; // session inject + centralized error mapping
import { jsonData } from "@/server/http/api-response"; // { data: ... } success JSON envelope
import * as workspaceService from "@/server/services/workspace.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    if (!session) throw unauthorized("Authentication required.");
    const result = await workspaceService.getCurrentWorkspaceMembers(session);
    return jsonData(result);
  },
  { requireAuth: true }, // anonymous caller → 401 unauthorized
);
