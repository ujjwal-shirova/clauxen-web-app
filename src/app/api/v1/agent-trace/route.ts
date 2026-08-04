import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { readTraces } from "@/server/agent-trace/trace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/agent-trace
 * Returns Agent Trace records (AI-generated code attribution) for the workspace.
 */
export const GET = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    const traces = readTraces();
    return jsonData({ traces });
  },
  { requireAuth: true },
);
