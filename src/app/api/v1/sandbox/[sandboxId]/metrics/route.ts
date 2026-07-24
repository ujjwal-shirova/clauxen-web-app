import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  assertSandboxOwnedBy,
  getSandboxMetrics,
} from "@/server/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const metrics = await getSandboxMetrics(params.sandboxId);
    return jsonData({ metrics });
  },
  { requireAuth: true },
);
