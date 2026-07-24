import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  assertSandboxOwnedBy,
  killSandbox,
} from "@/server/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const info = await assertSandboxOwnedBy(params.sandboxId, user.id);
    return jsonData(info);
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const result = await killSandbox(params.sandboxId);
    return jsonData(result);
  },
  { requireAuth: true },
);
