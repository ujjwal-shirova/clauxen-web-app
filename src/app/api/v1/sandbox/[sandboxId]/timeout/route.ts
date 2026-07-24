import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  assertSandboxOwnedBy,
  setSandboxTimeout,
} from "@/server/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const body = (await request.json()) as { timeoutMs: number };
    return jsonData(await setSandboxTimeout(params.sandboxId, body.timeoutMs));
  },
  { requireAuth: true },
);
