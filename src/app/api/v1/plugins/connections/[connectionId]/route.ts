import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { notFound } from "@/server/db/errors";
import * as repo from "@/server/repositories/plugin-connections.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/v1/plugins/connections/:connectionId
 *
 * Revokes the connection and deletes the sealed OAuth tokens, so the assistant
 * can no longer call that plugin's tools on the user's behalf.
 */
export const DELETE = withApiRouteParams<{ connectionId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);

    const revoked = await repo.revokeConnection(params.connectionId, user.id);
    if (!revoked) throw notFound("Connection not found.");

    return jsonData({ ok: true, connectionId: params.connectionId });
  },
  { requireAuth: true },
);
