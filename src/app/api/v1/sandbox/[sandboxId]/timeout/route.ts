import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  setSandboxTimeout,
} from "@/backend/sandbox/sandbox-manager";

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
