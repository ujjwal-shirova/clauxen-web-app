import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as workspaceService from "@/server/services/workspace.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // per-user workspace — caching unsafe

export const GET = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    const result = await workspaceService.getCurrentWorkspace(session); // memberships + workspaces join — owner/member role
    return jsonData(result);
  },
  { requireAuth: true },
);
