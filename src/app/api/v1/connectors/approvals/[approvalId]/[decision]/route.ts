import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import { decideConnectorApproval } from "@/server/connectors/gateway";
import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{
  approvalId: string;
  decision: string;
}>(
  async ({ session, params }) => {
    const user = requireSession(session);
    if (params.decision !== "approve" && params.decision !== "deny") {
      throw new AppError("Invalid approval decision.", 400, "invalid_decision");
    }
    return jsonData(
      await decideConnectorApproval(
        user.id,
        params.approvalId,
        params.decision,
      ),
    );
  },
  { requireAuth: true },
);
