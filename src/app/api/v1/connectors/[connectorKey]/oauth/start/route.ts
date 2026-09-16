import { requireSession } from "@/server/auth/require-session";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";
import { startConnectorOAuth } from "@/connectors/server/gateway";
import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ connectorKey: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(params.connectorKey)) {
      throw new AppError(
        "Invalid connector key.",
        400,
        "invalid_connector_key",
      );
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // An empty request body is valid.
    }
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : null;
    const returnPath =
      typeof body.returnPath === "string" && body.returnPath.startsWith("/")
        ? body.returnPath
        : "/connectors";
    const returnUrl = new URL(returnPath, env.appUrl);
    returnUrl.searchParams.set("connector", params.connectorKey);

    const result = await startConnectorOAuth(user.id, {
      connectorKey: params.connectorKey,
      workspaceId,
      returnUrl: returnUrl.toString(),
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
