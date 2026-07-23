import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  killSandbox,
} from "@/backend/sandbox/sandbox-manager";

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
