import { unauthorized } from "@/backend/db/errors";
import { withApiHandler } from "@/backend/http/api-handler"; // session inject + centralized error mapping
import { jsonData } from "@/backend/http/api-response"; // { data: ... } success JSON envelope
import * as workspaceService from "@/backend/services/workspace.service";

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
