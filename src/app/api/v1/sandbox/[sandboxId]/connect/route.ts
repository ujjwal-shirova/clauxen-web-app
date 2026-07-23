import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  connectSandbox,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const body = (await request.json().catch(() => ({}))) as {
      timeoutMs?: number;
    };
    const result = await connectSandbox(params.sandboxId, body.timeoutMs);
    return jsonData(result.info);
  },
  { requireAuth: true },
);
