import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  pauseSandbox,
} from "@/backend/sandbox/sandbox-manager";

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
