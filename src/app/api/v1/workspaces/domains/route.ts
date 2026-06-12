// Response: domain list (hostname, verification status) — enterprise SSO / email routing UI
// =============================================================================

import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as workspaceService from "@/backend/services/workspace.service";

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
