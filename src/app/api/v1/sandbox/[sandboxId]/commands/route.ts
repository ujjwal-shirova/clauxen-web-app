import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  runSandboxCommand,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const body = (await request.json()) as {
      command: string;
      background?: boolean;
      cwd?: string;
      envs?: Record<string, string>;
      timeoutMs?: number;
    };
    const result = await runSandboxCommand(params.sandboxId, body);
    return jsonData(result);
  },
  { requireAuth: true },
);
