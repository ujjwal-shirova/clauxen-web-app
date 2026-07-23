import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  assertSandboxOwnedBy,
  getSandboxPublicHost,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    await assertSandboxOwnedBy(params.sandboxId, user.id);
    const port = Number(
      new URL(request.url).searchParams.get("port") ?? "3000",
    );
    return jsonData(await getSandboxPublicHost(params.sandboxId, port));
  },
  { requireAuth: true },
);
