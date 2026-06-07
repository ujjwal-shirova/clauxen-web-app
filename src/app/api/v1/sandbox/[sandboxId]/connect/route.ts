import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { connectSandbox } from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as {
      timeoutMs?: number;
    };
    const result = await connectSandbox(params.sandboxId, body.timeoutMs);
    return jsonData(result.info);
  },
  { requireChatAuth: true },
);
