import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { getSandboxMetrics } from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ params }) => {
    const metrics = await getSandboxMetrics(params.sandboxId);
    return jsonData({ metrics });
  },
  { requireChatAuth: true },
);
