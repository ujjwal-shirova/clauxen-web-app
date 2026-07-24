// Response: domain list (hostname, verification status) — enterprise SSO / email routing UI
// =============================================================================

import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as workspaceService from "@/server/services/workspace.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session); // defense in depth — null/empty session → 401 before workspace lookup
    const result = await workspaceService.listCurrentWorkspaceDomains(user);
    return jsonData(result);
  },
  { requireAuth: true },
);
