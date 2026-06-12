import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { setSandboxTimeout } from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = withApiRouteParams<{ sandboxId: string }>(
  async ({ request, params }) => {
    const body = (await request.json()) as { timeoutMs: number };
    return jsonData(await setSandboxTimeout(params.sandboxId, body.timeoutMs));
  },
  { requireChatAuth: true },
);
