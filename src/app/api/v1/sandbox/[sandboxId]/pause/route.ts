import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  assertSandboxOwnedBy,
  pauseSandbox,
} from "@/server/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    return jsonData(await pauseSandbox(params.sandboxId));
  },
  { requireAuth: true },
);
